// lib/requireAdmin.ts
import 'server-only';

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export type RequireAdminResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      status: 200;
      adminSessionId: string;
      adminUserId: string;
      supabaseAdmin: typeof supabaseAdmin;
    };

export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing admin token. Please log in again.' };
  }

  const token = auth.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: 'Missing admin token. Please log in again.' };

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, revoked_at, user_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 401, error: 'Invalid admin token. Please log in again.' };
  }

  if (data.revoked_at) {
    return { ok: false, status: 401, error: 'Admin session revoked. Please log in again.' };
  }

  if (!data.user_id) {
    return {
      ok: false,
      status: 401,
      error: 'Admin session missing user_id. Please log out and log in again.',
    };
  }

  return {
    ok: true,
    status: 200,
    adminSessionId: String(data.id),
    adminUserId: String(data.user_id),
    supabaseAdmin,
  };
}
