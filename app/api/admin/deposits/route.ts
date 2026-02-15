// app/api/admin/deposits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getToken(req: NextRequest) {
  const h = req.headers.get('authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();

  // cookie fallback (if you later set it from login route)
  const c =
    req.cookies.get('novatrade_admin_token')?.value ||
    req.cookies.get('admin_token')?.value;

  return c || null;
}

async function requireAdmin(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      ok: false as const,
      status: 500,
      message:
        'Server misconfig: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    };
  }

  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, message: 'Missing admin token' };

  const nowIso = new Date().toISOString();
  const tokenHash = sha256Hex(token);

  // ✅ accept either:
  // - raw sessionToken (we hash it)
  // - OR if someone mistakenly sends token_hash directly (also 64-hex), accept it too
  const { data: sess, error: sessErr } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, admin_id, user_id, expires_at, revoked_at')
    .or(`token_hash.eq.${tokenHash},token_hash.eq.${token}`)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessErr || !sess?.id) {
    return { ok: false as const, status: 401, message: 'Invalid token' };
  }

  const adminId = sess.admin_id || sess.user_id;
  if (!adminId) {
    return { ok: false as const, status: 401, message: 'Invalid token' };
  }

  // best-effort session activity ping (don’t block request)
  void supabaseAdmin
    .from('admin_sessions')
    .update({
      last_activity_at: nowIso,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: req.headers.get('user-agent') || null,
    })
    .eq('id', sess.id);

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('users')
    .select('id, role, is_active')
    .eq('id', adminId)
    .maybeSingle();

  if (profErr || !profile?.id) {
    return { ok: false as const, status: 403, message: 'Not allowed' };
  }

  if (profile.is_active === false) {
    return { ok: false as const, status: 403, message: 'Account disabled' };
  }

  const role = String(profile.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'support', 'signal_provider'].includes(role)) {
    return { ok: false as const, status: 403, message: 'Not allowed' };
  }

  return { ok: true as const, adminId: adminId };
}

// ─────────────────────────────────────────────
// GET /api/admin/deposits?status=pending|processing|confirmed|rejected|all
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
        users:user_id ( id, email, first_name, last_name, tier_level, balance_available )
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/deposits  { depositId, action: 'approve'|'reject', note?, rejectedReason? }
// ─────────────────────────────────────────────
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
      .maybeSingle();

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
    const userId = String(deposit.user_id || '');
    const amount = Number(deposit.amount || 0);

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid deposit data' }, { status: 400 });
    }

    if (action === 'approve') {
      // 2a) Update deposit status (guarded)
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('deposits')
        .update({
          status: 'confirmed',
          processed_by: gate.adminId,
          processed_at: now,
          admin_note: note || null,
          updated_at: now,
        })
        .eq('id', depositId)
        .in('status', ['pending', 'processing'])
        .select('id, status')
        .maybeSingle();

      if (updErr) throw updErr;
      if (!upd?.id) {
        return NextResponse.json({ success: false, error: 'Deposit already processed' }, { status: 400 });
      }

      // 2b) Credit user balance
      const { data: userRow, error: userErr } = await supabaseAdmin
        .from('users')
        .select('balance_available')
        .eq('id', userId)
        .maybeSingle();

      if (userErr || !userRow) throw userErr || new Error('User not found');

      const currentBalance = Number(userRow.balance_available ?? 0);
      const newBalance = currentBalance + amount;

      const { error: balErr } = await supabaseAdmin
        .from('users')
        .update({ balance_available: newBalance })
        .eq('id', userId);

      if (balErr) throw balErr;

      // 2c) Log transaction (best effort)
      void supabaseAdmin.from('transactions').insert({
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

      // 2d) Notify user (best effort)
      void supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'deposit',
        title: 'Deposit Confirmed!',
        message: `Your $${amount.toFixed(2)} deposit has been confirmed and credited to your account.`,
        data: { deposit_id: depositId, amount },
      });

      return NextResponse.json({
        success: true,
        message: `Deposit approved. $${amount.toFixed(2)} credited to user.`,
        details: { newBalance, amount },
      });
    }

    // REJECT
    const { data: rej, error: rejErr } = await supabaseAdmin
      .from('deposits')
      .update({
        status: 'rejected',
        processed_by: gate.adminId,
        processed_at: now,
        rejection_reason: rejectedReason || 'Rejected by admin',
        admin_note: note || null,
        updated_at: now,
      })
      .eq('id', depositId)
      .in('status', ['pending', 'processing'])
      .select('id')
      .maybeSingle();

    if (rejErr) throw rejErr;
    if (!rej?.id) {
      return NextResponse.json({ success: false, error: 'Deposit already processed' }, { status: 400 });
    }

    void supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'alert',
      title: 'Deposit Rejected',
      message: `Your $${amount.toFixed(2)} deposit was rejected. ${rejectedReason || 'Contact support for details.'}`,
      data: { deposit_id: depositId, reason: rejectedReason },
    });

    return NextResponse.json({ success: true, message: 'Deposit rejected.' });
  } catch (err: any) {
    console.error('[Admin Deposits PATCH]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
