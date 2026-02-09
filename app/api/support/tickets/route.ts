import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // open|pending|closed|all

  let q = supabaseAdmin
    .from('support_tickets')
    .select(`
      id, user_id, subject, category, priority, status,
      created_at, updated_at, resolved_at,
      users:users ( id, email, first_name, last_name )
    `)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tickets: data ?? [] });
}
