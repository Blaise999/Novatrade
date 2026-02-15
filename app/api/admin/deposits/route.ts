// app/api/admin/deposits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----------------------------------------------------
// Helpers (JWT + custom admin session token support)
// ----------------------------------------------------
function isJwtLike(token: string) {
  // Supabase JWTs look like: header.payload.signature (2 dots)
  return token.split('.').length === 3;
}

function sha256hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function getToken(req: NextRequest) {
  const h = req.headers.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();

  // optional cookie fallback
  const c =
    req.cookies.get('novatrade_admin_token')?.value ||
    req.cookies.get('admin_token')?.value;

  return c || null;
}

/**
 * Supports 2 modes:
 * 1) Supabase JWT auth (Authorization: Bearer eyJ... . .)
 * 2) Custom admin session token (Authorization: Bearer <64-hex> OR raw token we hash)
 *
 * Mode (2) expects a table `admin_sessions` with at least:
 * - token_hash (text)
 * - admin_id (uuid)
 * - expires_at (timestamptz, nullable)
 * - revoked_at (timestamptz, nullable)
 * And `users` table has `role` for the admin_id user.
 */
async function requireAdmin(req: NextRequest) {
  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, message: 'Missing admin token' };

  // 1) JWT mode
  if (isJwtLike(token)) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user?.id) return { ok: false as const, status: 401, message: 'Invalid token' };

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', data.user.id)
      .maybeSingle();

    const role = String(profile?.role || '').toLowerCase();
    if (!['admin', 'super_admin', 'support'].includes(role)) {
      return { ok: false as const, status: 403, message: 'Not allowed' };
    }

    return { ok: true as const, adminId: data.user.id };
  }

  // 2) Custom admin session token mode
  const tokenHash = /^[a-f0-9]{64}$/i.test(token) ? token.toLowerCase() : sha256hex(token);

  const { data: sess, error: sessErr } = await supabaseAdmin
    .from('admin_sessions')
    .select(
      `
      admin_id,
      expires_at,
      revoked_at,
      users:admin_id ( id, role )
    `
    )
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .maybeSingle();

  if (sessErr || !sess?.admin_id) return { ok: false as const, status: 401, message: 'Invalid token' };

  if (sess.expires_at && new Date(sess.expires_at).getTime() < Date.now()) {
    return { ok: false as const, status: 401, message: 'Token expired' };
  }

  const role = String((sess as any)?.users?.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'support'].includes(role)) {
    return { ok: false as const, status: 403, message: 'Not allowed' };
  }

  return { ok: true as const, adminId: sess.admin_id };
}

// ----------------------------------------------------
// GET /api/admin/deposits?status=pending|confirmed|rejected|all
// NOTE: We map "pending" to (pending, processing)
//       and "confirmed" to (confirmed, approved, completed)
// ----------------------------------------------------
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || '').toLowerCase();

  try {
    let query = supabaseAdmin
      .from('deposits')
      .select(
        `
        *,
        users:user_id ( id, email, first_name, last_name, tier_level, balance_available )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && status !== 'all') {
      if (status === 'pending') {
        query = query.in('status', ['pending', 'processing']);
      } else if (status === 'confirmed') {
        query = query.in('status', ['confirmed', 'approved', 'completed']);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, deposits: data || [] });
  } catch (err: any) {
    console.error('[Admin Deposits GET]', err);
    return NextResponse.json({ success: false, error: err.message || 'Failed to load deposits' }, { status: 500 });
  }
}

// ----------------------------------------------------
// PATCH /api/admin/deposits
// body: { depositId, action: 'approve'|'reject', note?, rejectedReason? }
// Approve sets status to "completed" (matches your DB)
// ----------------------------------------------------
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });

  try {
    const body = await req.json();
    const { depositId, action, note, rejectedReason } = body || {};

    if (!depositId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'depositId and action (approve|reject) required' },
        { status: 400 }
      );
    }

    // 1) Fetch deposit
    const { data: deposit, error: fetchErr } = await supabaseAdmin
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single();

    if (fetchErr || !deposit) {
      return NextResponse.json({ success: false, error: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status !== 'pending' && deposit.status !== 'processing') {
      return NextResponse.json(
        { success: false, error: `Deposit already ${deposit.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const userId = deposit.user_id as string;
    const amount = Number(deposit.amount || 0);

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid deposit amount/user' }, { status: 400 });
    }

    if (action === 'approve') {
      // 2a) Update deposit status -> completed
      const { error: updErr } = await supabaseAdmin
        .from('deposits')
        .update({
          status: 'completed',
          processed_by: gate.adminId,
          processed_at: now,
          admin_note: note || null,
          updated_at: now,
        })
        .eq('id', depositId);

      if (updErr) throw updErr;

      // 2b) Credit user balance (simple add; for perfect safety use an RPC increment)
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('balance_available')
        .eq('id', userId)
        .single();

      if (userErr) throw userErr;

      const currentBalance = Number(userRow?.balance_available ?? 0);
      const newBalance = currentBalance + amount;

      const { error: balErr } = await supabaseAdmin
        .from('users')
        .update({ balance_available: newBalance })
        .eq('id', userId);

      if (balErr) throw balErr;

      // 2c) Log transaction (optional table)
      try {
        await supabaseAdmin.from('transactions').insert({
          user_id: userId,
          type: 'deposit',
          amount,
          currency: deposit.currency || 'USD',
          balance_before: currentBalance,
          balance_after: newBalance,
          status: 'completed',
          reference_type: 'deposit_approval',
          description: `Deposit approved: $${amount.toFixed(2)} via ${deposit.method_name || deposit.method || 'crypto'}`,
          metadata: { deposit_id: depositId, approved_by: gate.adminId },
        });
      } catch {}

      // 2d) Notify user (optional table)
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          type: 'deposit',
          title: 'Deposit Confirmed!',
          message: `Your $${amount.toFixed(2)} deposit has been confirmed and credited to your account.`,
          data: { deposit_id: depositId, amount },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Deposit approved. $${amount.toFixed(2)} credited to user.`,
        details: { newBalance, amount },
      });
    }

    // REJECT
    const { error: rejErr } = await supabaseAdmin
      .from('deposits')
      .update({
        status: 'rejected',
        processed_by: gate.adminId,
        processed_at: now,
        rejection_reason: rejectedReason || 'Rejected by admin',
        admin_note: note || null,
        updated_at: now,
      })
      .eq('id', depositId);

    if (rejErr) throw rejErr;

    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'alert',
        title: 'Deposit Rejected',
        message: `Your $${amount.toFixed(2)} deposit was rejected. ${rejectedReason || 'Contact support for details.'}`,
        data: { deposit_id: depositId, reason: rejectedReason },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'Deposit rejected.' });
  } catch (err: any) {
    console.error('[Admin Deposits PATCH]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process deposit' },
      { status: 500 }
    );
  }
}
