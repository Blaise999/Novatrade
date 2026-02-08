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
  return { tokenHash };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = params?.userId;
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        kyc_status: 'verified',
        kyc_verified_at: now,
        updated_at: now,
      })
      .eq('id', userId)
      .select('id, email, kyc_status, kyc_verified_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, user: data });
  } catch (e: any) {
    console.error('[Admin] approve kyc error:', e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
