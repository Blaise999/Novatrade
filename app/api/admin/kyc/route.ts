// app/api/admin/kyc/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const ok = await requireAdmin(request);
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const status = url.searchParams.get('status'); // pending|verified|rejected|none|all

    let q = supabaseAdmin
      .from('users')
      .select(
        'id,email,first_name,last_name,kyc_status,kyc_data,kyc_submitted_at,created_at'
      )
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      if (status === 'none') q = q.or('kyc_status.is.null,kyc_status.eq.none,kyc_status.eq.not_started');
      else q = q.eq('kyc_status', status);
    }

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (e: any) {
    console.error('[AdminKYC] list error:', e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
