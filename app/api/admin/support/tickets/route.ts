import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DbTicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';

function mapFilterToStatuses(filter: string | null): DbTicketStatus[] | null {
  if (!filter || filter === 'all') return null;
  if (filter === 'open') return ['open', 'in_progress'];
  if (filter === 'pending') return ['waiting_user'];
  if (filter === 'closed') return ['closed', 'resolved'];
  return null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  try {
    const { searchParams } = request.nextUrl;
    const filter = searchParams.get('filter');
    const statuses = mapFilterToStatuses(filter);

    let q = admin.supabaseAdmin
      .from('support_tickets')
      .select(
        'id,user_id,assigned_to,subject,category,priority,status,created_at,updated_at,resolved_at'
      )
      .order('updated_at', { ascending: false })
      .limit(200);

    if (statuses) q = q.in('status', statuses);

    const { data: tickets, error } = await q;
    if (error) throw error;

    const list = tickets ?? [];
    const ticketIds = list.map((t) => t.id);

    // ---- pull latest message for each ticket (single query, no N+1)
    let lastByTicket: Record<string, any> = {};
    if (ticketIds.length) {
      const { data: msgs, error: mErr } = await admin.supabaseAdmin
        .from('support_messages')
        .select('ticket_id,message,sender_type,created_at')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (mErr) throw mErr;

      for (const m of msgs ?? []) {
        if (!lastByTicket[m.ticket_id]) lastByTicket[m.ticket_id] = m; // first seen = newest (we sorted desc)
      }
    }

    // ---- fetch users referenced by user_id / assigned_to (single query)
    const userIds = Array.from(
      new Set(
        list
          .flatMap((t) => [t.user_id, t.assigned_to])
          .filter(Boolean) as string[]
      )
    );

    let usersById: Record<string, any> = {};
    if (userIds.length) {
      const { data: users, error: uErr } = await admin.supabaseAdmin
        .from('users')
        .select('id,email,first_name,last_name')
        .in('id', userIds);

      if (uErr) throw uErr;

      for (const u of users ?? []) usersById[u.id] = u;
    }

    const out = list.map((t: any) => ({
      ...t,
      users: usersById[t.user_id] ?? null,          // keep same shape your UI expects
      assignee: usersById[t.assigned_to] ?? null,   // optional, for later
      last_message: lastByTicket[t.id] ?? null,
    }));

    return NextResponse.json({ tickets: out });
  } catch (e: any) {
    console.error('[AdminSupport] loadTickets error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to load tickets' }, { status: 500 });
  }
}
