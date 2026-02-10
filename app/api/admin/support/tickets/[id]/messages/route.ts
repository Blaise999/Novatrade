import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: list messages for a ticket
export async function GET(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);

  // ✅ null-guard (fixes: "admin is possibly null")
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const ticketId = ctx.params.id;

  try {
    const { data: messages, error } = await admin.supabaseAdmin
      .from('support_messages')
      .select('id,ticket_id,sender_id,sender_type,message,attachments,read_at,created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) throw error;

    return NextResponse.json({ messages: messages ?? [] });
  } catch (e: any) {
    console.error('[AdminSupport] GET messages error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to load messages' },
      { status: 500 }
    );
  }
}

// POST: admin reply to ticket
export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);

  // ✅ null-guard (fixes: "admin is possibly null")
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const ticketId = ctx.params.id;

  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body?.message ?? '').trim();
    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const senderId = admin.adminId ?? (body?.adminId ? String(body.adminId) : null);

    const { data: inserted, error: insErr } = await admin.supabaseAdmin
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: senderId,
        sender_type: 'admin',
        message,
        attachments: body?.attachments ?? [],
      })
      .select('id,ticket_id,sender_id,sender_type,message,attachments,read_at,created_at')
      .single();

    if (insErr) throw insErr;

    // Mark ticket as waiting for user reply
    await admin.supabaseAdmin
      .from('support_tickets')
      .update({
        status: 'waiting_user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);

    return NextResponse.json({ message: inserted });
  } catch (e: any) {
    console.error('[AdminSupport] POST message error:', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
