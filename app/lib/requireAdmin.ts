// lib/requireAdmin.ts
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

export type RequireAdminResult =
  | {
      ok: true;
      adminSessionId: string;
      adminId: string | null;
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
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 403, error: 'Invalid admin token. Please log in again.' };
  }

  if ((data as any).revoked_at) {
    return { ok: false, status: 403, error: 'Admin session revoked. Please log in again.' };
  }

  return {
    ok: true,
    adminSessionId: String((data as any).id),
    adminId: ((data as any).admin_id ?? (data as any).user_id ?? null) as string | null,
    supabaseAdmin,
  };
}
