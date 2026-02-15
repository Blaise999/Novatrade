// app/api/admin/deposits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const c = req.cookies.get('novatrade_admin_token')?.value;
  return c || null;
}

async function requireAdmin(req: NextRequest) {
  const token = getToken(req);
  if (!token) return { ok: false as const, status: 401, message: 'Missing admin token' };

  // IMPORTANT: this token must be a Supabase Auth ACCESS token (JWT).
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) return { ok: false as const, status: 401, message: 'Invalid token' };

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 500, message: profErr.message };

  const role = String(profile?.role || '').toLowerCase();
  if (!['admin', 'super_admin', 'support'].includes(role)) {
    return { ok: false as const, status: 403, message: 'Not allowed' };
  }

  return { ok: true as const, adminId: data.user.id };
}

function statusFilterParamToDb(statusParam: string | null) {
  const s = (statusParam || '').toLowerCase().trim();
  if (!s || s === 'all') return { kind: 'all' as const };

  if (s === 'pending') return { kind: 'eq' as const, value: 'pending' };

  // UI uses "confirmed" but DB already has "completed"
  if (s === 'confirmed') return { kind: 'in' as const, values: ['confirmed', 'approved', 'completed'] };

  if (s === 'rejected') return { kind: 'eq' as const, value: 'rejected' };

  // fallback
  return { kind: 'eq' as const, value: s };
}

// ──────────────────────────────
// GET /api/admin/deposits?status=pending|confirmed|rejected|all
// ──────────────────────────────
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });
  }

  try {
    const statusParam = req.nextUrl.searchParams.get('status');
    const filt = statusFilterParamToDb(statusParam);

    let q: any = supabaseAdmin
      .from('deposits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filt.kind === 'eq') q = q.eq('status', filt.value);
    if (filt.kind === 'in') q = q.in('status', filt.values);

    const { data: deposits, error } = await q;
    if (error) throw error;

    // Attach user info manually (no fragile join syntax)
    const userIds = Array.from(new Set((deposits || []).map((d: any) => d.user_id).filter(Boolean)));
    let usersById: Record<string, any> = {};

    if (userIds.length) {
      const { data: users, error: uErr } = await supabaseAdmin
        .from('users')
        .select('id, email, first_name, last_name, tier_level, balance_available')
        .in('id', userIds);

      if (!uErr && users) {
        for (const u of users) usersById[String(u.id)] = u;
      }
    }

    const enriched = (deposits || []).map((d: any) => ({
      ...d,
      users: usersById[String(d.user_id)] || undefined,
    }));

    return NextResponse.json({ success: true, deposits: enriched });
  } catch (err: any) {
    console.error('[Admin Deposits GET]', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to load deposits' }, { status: 500 });
  }
}

// ──────────────────────────────
// PATCH /api/admin/deposits  { depositId, action: 'approve'|'reject', note?, rejectedReason? }
// ──────────────────────────────
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.message }, { status: gate.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const depositId = String(body?.depositId || '');
    const action = String(body?.action || '').toLowerCase();
    const note = body?.note ?? null;
    const rejectedReason = body?.rejectedReason ?? body?.rejection_reason ?? null;

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
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!deposit) return NextResponse.json({ success: false, error: 'Deposit not found' }, { status: 404 });

    if (deposit.status !== 'pending' && deposit.status !== 'processing') {
      return NextResponse.json({ success: false, error: `Deposit already ${deposit.status}` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const userId = deposit.user_id;
    const amount = Number(deposit.amount || 0);

    if (action === 'approve') {
      // Use "completed" because your DB already uses it
      const { error: upErr } = await supabaseAdmin
        .from('deposits')
        .update({
          status: 'completed',
          processed_by: gate.adminId,
          processed_at: now,
          admin_note: note,
          updated_at: now,
        })
        .eq('id', depositId);

      if (upErr) throw upErr;

      // credit balance (non-atomic, but ok for now; we can harden later with an RPC)
      const { data: userRow, error: uErr } = await supabaseAdmin
        .from('users')
        .select('balance_available')
        .eq('id', userId)
        .maybeSingle();

      if (uErr) throw uErr;

      const currentBalance = Number(userRow?.balance_available ?? 0);
      const newBalance = currentBalance + amount;

      const { error: balErr } = await supabaseAdmin
        .from('users')
        .update({ balance_available: newBalance })
        .eq('id', userId);

      if (balErr) throw balErr;

      // optional logs (only if tables exist)
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
        admin_note: note,
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
    return NextResponse.json({ success: false, error: err?.message || 'Failed' }, { status: 500 });
  }
}
