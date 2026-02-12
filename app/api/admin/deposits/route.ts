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

// ─────────────────────────────────────────────
// GET /api/admin/deposits?status=pending
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');

  try {
    let query = supabaseAdmin
      .from('deposits')
      .select(`
        *,
        users:user_id ( id, email, first_name, last_name, tier_level, balance_available )
      `)
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/deposits  { depositId, action: 'approve'|'reject', note?, rejectedReason? }
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  try {
    const body = await req.json();
    const { depositId, action, note, rejectedReason } = body;

    if (!depositId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'depositId and action (approve|reject) required' }, { status: 400 });
    }

    // 1. Get the deposit
    const { data: deposit, error: fetchErr } = await supabaseAdmin
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single();

    if (fetchErr || !deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    if (deposit.status !== 'pending' && deposit.status !== 'processing') {
      return NextResponse.json({ error: `Deposit already ${deposit.status}` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const userId = deposit.user_id;
    const amount = Number(deposit.amount || 0);

    if (action === 'approve') {
      // 2a. Update deposit status
      await supabaseAdmin
        .from('deposits')
        .update({
          status: 'confirmed',
          processed_by: gate.adminId,
          processed_at: now,
          admin_note: note || null,
          updated_at: now,
        })
        .eq('id', depositId);

      // 2b. Credit user balance
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('balance_available')
        .eq('id', userId)
        .single();

      const currentBalance = Number(userRow?.balance_available ?? 0);
      const newBalance = currentBalance + amount;

      await supabaseAdmin
        .from('users')
        .update({ balance_available: newBalance })
        .eq('id', userId);

      // 2c. Log transaction
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

      // 2d. Create notification
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
    } else {
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

      // Notify user
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          type: 'alert',
          title: 'Deposit Rejected',
          message: `Your $${amount.toFixed(2)} deposit was rejected. ${rejectedReason || 'Contact support for details.'}`,
          data: { deposit_id: depositId, reason: rejectedReason },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: `Deposit rejected.`,
      });
    }
  } catch (err: any) {
    console.error('[Admin Deposits PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
