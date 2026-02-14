// app/api/admin/support/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DbTicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const url = new URL(request.url);
  const filter = (url.searchParams.get('filter') || 'open').toLowerCase();

  const statusMap: Record<string, DbTicketStatus[] | null> = {
    all: null,
    open: ['open', 'in_progress'],
    pending: ['waiting_user'],
    closed: ['closed', 'resolved'],
  };

  const statuses = statusMap[filter] ?? statusMap.open;

  try {
    let q = admin.supabaseAdmin
      .from('support_tickets')
      .select('id,user_id,assigned_to,subject,category,priority,status,created_at,updated_at,resolved_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (statuses) q = q.in('status', statuses);

    const { data: tickets, error: tErr } = await q;
    if (tErr) throw tErr;

    const list = tickets ?? [];
    const userIds = Array.from(new Set(list.map((t) => t.user_id).filter(Boolean)));

    // users lookup
    const usersById = new Map<string, any>();
    if (userIds.length) {
      const { data: users, error: uErr } = await admin.supabaseAdmin
        .from('users')
        .select('id,email,first_name,last_name')
        .in('id', userIds);

      if (uErr) throw uErr;
      (users ?? []).forEach((u) => usersById.set(u.id, u));
    }

    // last message lookup (one query)
    const ticketIds = list.map((t) => t.id);
    const lastByTicket = new Map<string, any>();

    if (ticketIds.length) {
      const { data: msgs, error: mErr } = await admin.supabaseAdmin
        .from('support_messages')
        .select('ticket_id,message,sender_type,created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (mErr) throw mErr;

      for (const m of msgs ?? []) {
        if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m);
      }
    }

    const merged = list.map((t) => ({
      ...t,
      users: usersById.get(t.user_id) ?? null,
      last_message: lastByTicket.get(t.id) ?? null,
    }));

    return NextResponse.json({ tickets: merged });
  } catch (e: any) {
    console.error('[AdminSupport] tickets GET error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to load tickets' }, { status: 500 });
  }
}
