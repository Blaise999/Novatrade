import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const ticketId = ctx.params.id;

  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body?.message ?? '').trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : null;

    if (!text) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    // ✅ sender_id ALWAYS from server session (never from client)
    const { data, error } = await admin.supabaseAdmin
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'admin',
        sender_id: admin.adminId, // ✅ never null now
        message: text,
        attachments,
      })
      .select('id,ticket_id,sender_id,sender_type,message,attachments,read_at,created_at')
      .single();

    if (error) throw error;

    await admin.supabaseAdmin
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString(), status: 'waiting_user' })
      .eq('id', ticketId);

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (e: any) {
    console.error('[AdminSupport] send message error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to send message' }, { status: 500 });
  }
}
