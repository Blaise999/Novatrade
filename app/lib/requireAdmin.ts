// lib/requireAdmin.ts
import 'server-only';

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

type AdminSessionRow = {
  id: string;
  token_hash: string;
  revoked_at: string | null;

  // one of these should exist depending on your schema
  admin_id?: string | null;
  user_id?: string | null;
};

export type RequireAdminResult =
  | {
      ok: true;
      status: 200;
      adminSessionId: string;
      adminId: string; // ✅ always a real id when ok=true
      supabaseAdmin: typeof supabaseAdmin;
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

export async function requireAdmin(req: NextRequest): Promise<RequireAdminResult> {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing admin token. Please log in again.' };
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Missing admin token. Please log in again.' };
  }

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, revoked_at, admin_id, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 403, error: 'Invalid admin token. Please log in again.' };
  }

  const row = data as AdminSessionRow;

  if (row.revoked_at) {
    return { ok: false, status: 403, error: 'Admin session revoked. Please log in again.' };
  }

  const adminId = row.admin_id ?? row.user_id ?? null;

  // ✅ IMPORTANT: do NOT allow ok=true with adminId=null
  if (!adminId) {
    return {
      ok: false,
      status: 403,
      error: 'Admin session missing admin_id/user_id. Log out and log in again.',
    };
  }

  return {
    ok: true,
    status: 200,
    adminSessionId: String(row.id),
    adminId: String(adminId),
    supabaseAdmin,
  };
}
