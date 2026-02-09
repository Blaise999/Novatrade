import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = ctx.params.id;

  const { data: ticket, error: te } = await supabaseAdmin
    .from('support_tickets')
    .select(`
      *,
      users:users ( id, email, first_name, last_name )
    `)
    .eq('id', id)
    .single();

  if (te || !ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const { data: messages, error: me } = await supabaseAdmin
    .from('support_messages')
    .select('id, ticket_id, sender_id, sender_type, message, attachments, read_at, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (me) return NextResponse.json({ error: me.message }, { status: 500 });

  return NextResponse.json({ ticket, messages: messages ?? [] });
}
