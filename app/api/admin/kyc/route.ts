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

// change if your bucket name is different
const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET || 'documents';

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

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) return null;

  return { tokenHash, adminId: (data as any).admin_id ?? null, sessionId: data.id };
}

async function signedUrl(path?: string | null) {
  if (!path) return null;

  // IMPORTANT: path must be the object key inside the bucket (no bucket prefix)
  const { data, error } = await supabaseAdmin.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, 60 * 15);

  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || 'pending').toLowerCase();

    let q = supabaseAdmin
      .from('users')
      .select('id,email,first_name,last_name,kyc_status,kyc_submitted_at,kyc_data,created_at');

    // ✅ filtering
    if (status !== 'all') {
      if (status === 'none') {
        q = q.or('kyc_status.is.null,kyc_status.eq.none,kyc_status.eq.not_started');
      } else if (status === 'verified') {
        q = q.in('kyc_status', ['verified', 'approved']); // allow both
      } else {
        q = q.eq('kyc_status', status);
      }
    }

    // ✅ ordering (push null submissions to bottom)
    q = q
      .order('kyc_submitted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data: rows, error } = await q;
    if (error) throw error;

    const kycs = await Promise.all(
      (rows ?? []).map(async (u: any) => {
        const k = u.kyc_data || {};
        return {
          ...u,
          kyc_docs: {
            id_front: await signedUrl(k.id_front_doc),
            id_back: await signedUrl(k.id_back_doc),
            selfie: await signedUrl(k.selfie_doc),
            proof: await signedUrl(k.proof_of_address_doc),
          },
        };
      })
    );

    return NextResponse.json({ kycs });
  } catch (e: any) {
    console.error('[AdminKYC] list error:', e);
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
``
