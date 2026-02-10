// app/api/admin/support/tickets/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const ticketId = ctx.params.id;

  try {
    // Ensure ticket exists
    const { data: ticket, error: tErr } = await admin.supabaseAdmin
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    const { data: messages, error: mErr } = await admin.supabaseAdmin
      .from('support_messages')
      .select('id,ticket_id,sender_id,sender_type,message,attachments,read_at,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(500);

    if (mErr) throw mErr;

    return NextResponse.json({ messages: messages ?? [] });
  } catch (e: any) {
    console.error('[AdminSupport] messages GET error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const ticketId = ctx.params.id;

  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body?.message ?? '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : null;

    if (!text) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // ✅ IMPORTANT: sender_id MUST come from requireAdmin() (never from client body)
    const senderId = admin.adminId; // guaranteed string when admin.ok === true

    const { data: inserted, error: iErr } = await admin.supabaseAdmin
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'admin',
        sender_id: senderId,
        message: text,
        attachments,
      })
      .select('id,ticket_id,sender_id,sender_type,message,attachments,read_at,created_at')
      .single();

    if (iErr) throw iErr;

    // bump ticket updated_at + (optionally) set status to waiting_user when admin replies
    await admin.supabaseAdmin
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString(), status: 'waiting_user' })
      .eq('id', ticketId)
      .neq('status', 'closed')
      .neq('status', 'resolved');

    return NextResponse.json({ message: inserted }, { status: 201 });
  } catch (e: any) {
    console.error('[AdminSupport] messages POST error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to send message' }, { status: 500 });
  }
}
