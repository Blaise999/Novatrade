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
  const h = req.headers.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();

  // optional cookie support (if you ever set it)
  const c =
    req.cookies.get('novatrade_admin_token')?.value ||
    req.cookies.get('admin_token')?.value ||
    null;

  return c || null;
}

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function requireAdmin(req: NextRequest) {
  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, message: 'Missing admin token' };

  // ✅ YOUR DB stores sha256(rawToken) in admin_sessions.token_hash
  const tokenHash = sha256Hex(token);

  const { data: session, error: sessErr } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, admin_id, user_id, expires_at, revoked_at')
    .or(`token_hash.eq.${tokenHash},token_hash.eq.${token}`) // supports legacy if raw was stored
    .maybeSingle();

  if (sessErr || !session?.id) {
    return { ok: false as const, status: 401, message: 'Invalid token' };
  }

  if (session.revoked_at) {
    return { ok: false as const, status: 401, message: 'Session revoked' };
  }

  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : 0;
  if (expiresAt && Date.now() > expiresAt) {
    return { ok: false as const, status: 401, message: 'Session expired' };
  }

  // keep session fresh (optional but useful)
  try {
    await supabaseAdmin
      .from('admin_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', session.id);
  } catch {}

  // ✅ who is the admin?
  const adminId = session.admin_id || session.user_id;
  if (!adminId) {
    return { ok: false as const, status: 401, message: 'Invalid session (no admin_id)' };
  }

  // role check
  const { data: profile, error: profErr } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', adminId)
    .maybeSingle();

  if (profErr || !profile?.id) {
    return { ok: false as const, status: 403, message: 'Admin profile missing' };
  }

  const role = String(profile.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'support'].includes(role)) {
    return { ok: false as const, status: 403, message: 'Not allowed' };
  }

  return { ok: true as const, adminId };
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
        *,
        users:user_id (
          id, email, first_name, last_name, tier_level, balance_available
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, deposits: data || [] });
  } catch (err: any) {
    console.error('[Admin Deposits GET]', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/deposits
// body: { depositId, action: 'approve'|'reject', note?, rejectedReason? }
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });

  try {
    const body = await req.json();
    const { depositId, action, note, rejectedReason } = body;

    if (!depositId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'depositId and action (approve|reject) required' },
        { status: 400 }
      );
    }

    // 1) Get deposit
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
      // 2a) Update deposit
      await supabaseAdmin
        .from('deposits')
        .update({
          status: 'confirmed', // keep your existing status
          processed_by: gate.adminId,
          processed_at: now,
          admin_note: note || null,
          updated_at: now,
        })
        .eq('id', depositId);

      // 2b) Credit user
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('balance_available')
        .eq('id', userId)
        .single();

      const currentBalance = Number(userRow?.balance_available ?? 0);
      const newBalance = currentBalance + amount;

      await supabaseAdmin.from('users').update({ balance_available: newBalance }).eq('id', userId);

      // 2c) Log transaction
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

      // 2d) Notify
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
    await supabaseAdmin
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
    return NextResponse.json({ success: false, error: err?.message || 'Server error' }, { status: 500 });
  }
}
