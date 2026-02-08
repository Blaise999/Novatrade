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
  const token = auth.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, admin_id, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;

  return { adminId: (data as any).admin_id ?? null };
}

export async function POST(request: NextRequest, ctx: { params: { userId: string } }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = ctx.params.userId;

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        kyc_status: 'rejected',
        kyc_reviewed_at: new Date().toISOString(),
        kyc_reviewed_by: admin.adminId,
      } as any)
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

 try {
  const { error: logError } = await supabaseAdmin.from('admin_logs').insert({
    admin_id: admin.adminId,
    action: 'kyc_reject',
    target_type: 'user',
    target_id: userId,
    created_at: new Date().toISOString(),
  } as any);
} catch {
  // ignore
}


    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[AdminKYC] reject error:', e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
