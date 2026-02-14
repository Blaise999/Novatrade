import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed = new Set(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']);

export async function POST(request: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ticketId = ctx.params.id;

  try {
    const body = await request.json().catch(() => ({}));
    const status = String(body?.status ?? '').trim();

    if (!allowed.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const patch: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'closed' || status === 'resolved') {
      patch.resolved_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabaseAdmin
      .from('support_tickets')
      .update(patch)
      .eq('id', ticketId)
      .select('id,user_id,assigned_to,subject,category,priority,status,created_at,updated_at,resolved_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ ticket: updated });
  } catch (e: any) {
    console.error('[AdminSupport] status error:', e);
    return NextResponse.json({ error: e?.message || 'Failed to update status' }, { status: 500 });
  }
}
