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

function getToken(req: NextRequest) {
  const h = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const m = h.match(/^bearer\s+(.+)$/i);
  if (m?.[1]) return m[1].trim();
  return req.cookies.get('novatrade_admin_token')?.value || null;
}

function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function requireAdmin(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false as const, status: 500, message: 'Server misconfigured (missing Supabase env)' };
  }

  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, message: 'Missing admin token' };

  // ✅ Accept either raw token OR token_hash
  const tokenHash = sha256Hex(token);

  // Try raw token first
  let session:
    | { admin_id: string; expires_at: string | null; revoked_at: string | null }
    | null = null;

  const { data: s1, error: e1 } = await supabaseAdmin
    .from('admin_sessions')
    .select('admin_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (!e1 && s1?.admin_id) session = s1 as any;

  // Fallback: token_hash
  if (!session) {
    const { data: s2, error: e2 } = await supabaseAdmin
      .from('admin_sessions')
      .select('admin_id, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!e2 && s2?.admin_id) session = s2 as any;
  }

  if (!session?.admin_id) {
    return { ok: false as const, status: 401, message: 'Invalid token' };
  }

  if (session.revoked_at) {
    return { ok: false as const, status: 401, message: 'Token revoked' };
  }

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false as const, status: 401, message: 'Token expired' };
  }

  // Role check
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', session.admin_id)
    .maybeSingle();

  if (profErr || !profile?.id) {
    return { ok: false as const, status: 401, message: 'Admin profile not found' };
  }

  const role = String(profile.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'support'].includes(role)) {
    return { ok: false as const, status: 403, message: 'Not allowed' };
  }

  return { ok: true as const, adminId: session.admin_id };
}

// ─────────────────────────────────────────────
// GET /api/admin/deposits?status=pending
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  try {
    let query = supabaseAdmin
      .from('deposits')
      .select(
        `
        id,
        user_id,
        amount,
        currency,
        method,
        method_name,
        network,
        transaction_ref,
        tx_hash,
        proof_url,
        status,
        admin_note,
        rejection_reason,
        note,
        processed_at,
        created_at,
        users:user_id (
          id, email, first_name, last_name, tier_level, balance_available
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, deposits: data || [] });
  } catch (err: any) {
    console.error('[Admin Deposits GET]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/deposits
// body: { depositId, action:'approve'|'reject', note?, rejectedReason? }
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));
    const { depositId, action, note, rejectedReason } = body;

    if (!depositId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'depositId and action (approve|reject) required' },
        { status: 400 }
      );
    }

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
    const userId = deposit.user_id;
    const amount = Number(deposit.amount || 0);

    if (action === 'approve') {
      const { error: upErr } = await supabaseAdmin
        .from('deposits')
        .update({
          status: 'confirmed',
          processed_by: gate.adminId,
          processed_at: now,
          admin_note: note || null,
          updated_at: now,
        })
        .eq('id', depositId);

      if (upErr) return NextResponse.json({ success: false, error: upErr.message }, { status: 500 });

      const { data: userRow, error: uErr } = await supabaseAdmin
        .from('users')
        .select('balance_available')
        .eq('id', userId)
        .single();

      if (uErr) return NextResponse.json({ success: false, error: uErr.message }, { status: 500 });

      const currentBalance = Number(userRow?.balance_available ?? 0);
      const newBalance = currentBalance + amount;

      const { error: balErr } = await supabaseAdmin
        .from('users')
        .update({ balance_available: newBalance })
        .eq('id', userId);

      if (balErr) return NextResponse.json({ success: false, error: balErr.message }, { status: 500 });

      // optional logs (safe)
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

    // reject
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

    if (rejErr) return NextResponse.json({ success: false, error: rejErr.message }, { status: 500 });

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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
