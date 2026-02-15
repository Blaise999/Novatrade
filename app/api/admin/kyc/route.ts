import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'Missing admin token' };

  // hash token like your db usually stores it
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const sb = supabaseAdmin();

  // admin_sessions table assumed from your migration
  const { data: session, error } = await sb
    .from('admin_sessions')
    .select('id, admin_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !session) return { ok: false, status: 401, error: 'Invalid admin session' };
  if (session.revoked_at) return { ok: false, status: 401, error: 'Session revoked' };
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: 'Session expired' };
  }

  return { ok: true, adminId: session.admin_id as string };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const sb = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const status = (searchParams.get('status') || 'all').toLowerCase();

  let q = sb
    .from('users')
    .select('id,email,first_name,last_name,kyc_status,created_at,kyc_submitted_at,kyc_data');

  if (status !== 'all') q = q.eq('kyc_status', status);

  const { data: rows, error } = await q.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const makeSigned = async (path?: string | null) => {
    if (!path) return null;
    const { data, error: e } = await sb.storage
      .from('kyc-documents')
      .createSignedUrl(path, 60 * 20); // 20 mins
    if (e) return null;
    return data.signedUrl;
  };

  const kycs = await Promise.all(
    (rows || []).map(async (u: any) => {
      const meta = u.kyc_data || {};
      return {
        ...u,
        kyc_docs: {
          id_front: await makeSigned(meta.id_front_doc),
          id_back: await makeSigned(meta.id_back_doc),
          selfie: await makeSigned(meta.selfie_doc),
          proof: await makeSigned(meta.proof_of_address_doc),
        },
      };
    })
  );

  return NextResponse.json({ kycs });
}
