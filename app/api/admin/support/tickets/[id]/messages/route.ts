import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const ticketId = ctx.params.id;

  try {
    const { data: ticket, error: tErr } = await admin.supabaseAdmin
      .from('support_tickets')
      .select('id,user_id,assigned_to,subject,category,priority,status,created_at,updated_at,resolved_at')
      .eq('id', ticketId)
      .single();

    if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const { data: userRow } = await admin.supabaseAdmin
      .from('users')
      .select('id,email,first_name,last_name')
      .eq('id', ticket.user_id)
      .maybeSingle();

    const { data: messages, error: mErr } = await admin.supabaseAdmin
      .from('support_messages')
      .select('id,ticket_id,sender_id,sender_type,message,attachments,read_at,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(500);

    if (mErr) throw mErr;

    return NextResponse.json({
      ticket: { ...ticket, users: userRow ?? null },
      messages: messages ?? [],
    });
  } catch (e: any) {
    console.error('[AdminSupport] openTicket error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to open ticket' }, { status: 500 });
  }
}
