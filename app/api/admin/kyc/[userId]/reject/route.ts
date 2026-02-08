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

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sb = supabaseAdmin();

  const { data: session } = await sb
    .from('admin_sessions')
    .select('admin_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!session || session.revoked_at) return { ok: false, status: 401, error: 'Invalid admin session' };
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: 'Session expired' };
  }

  return { ok: true, adminId: session.admin_id as string };
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const sb = supabaseAdmin();
  const userId = params.userId;
  const now = new Date().toISOString();

  let reason: string | null = null;
  try {
    const body = await req.json();
    reason = body?.reason ? String(body.reason) : null;
  } catch {}

  const { data, error } = await sb
    .from('users')
    .update({
      kyc_status: 'rejected',
      kyc_reviewed_at: now,
      kyc_reviewed_by: guard.adminId,
      kyc_rejection_reason: reason,
      updated_at: now,
    })
    .eq('id', userId)
    .select('id, kyc_status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, user: data });
}
