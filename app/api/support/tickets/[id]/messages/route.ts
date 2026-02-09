import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticketId = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const text = String(body?.message ?? '').trim();
  const adminId = String(body?.adminId ?? '').trim();

  if (!text) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  const { data: msg, error: ie } = await supabaseAdmin
    .from('support_messages')
    .insert({
      ticket_id: ticketId,
      sender_id: adminId || null,
      sender_type: 'admin',
      message: text,
      attachments: [],
      read_at: null,
    })
    .select()
    .single();

  if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });

  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'waiting_user', updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  return NextResponse.json({ message: msg });
}
