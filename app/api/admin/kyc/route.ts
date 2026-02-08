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

async function signed(path?: string | null) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(path, 60 * 15); // 15 minutes
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const { data: rows, error } = await supabaseAdmin
      .from('users')
      .select(
        'id, email, first_name, last_name, kyc_status, kyc_submitted_at, kyc_data'
      )
      .eq('kyc_status', status)
      .order('kyc_submitted_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all(
      (rows ?? []).map(async (u: any) => {
        const k = u.kyc_data || {};
        return {
          ...u,
          kyc_docs: {
            id_front: await signed(k.id_front_doc),
            id_back: await signed(k.id_back_doc),
            selfie: await signed(k.selfie_doc),
            proof: await signed(k.proof_of_address_doc),
          },
        };
      })
    );

    return NextResponse.json({ kycs: enriched });
  } catch (e: any) {
    console.error('[Admin] kyc list error:', e);
    return NextResponse.json(
      { error: e?.message ?? 'Server error' },
      { status: 500 }
    );
  }
}
