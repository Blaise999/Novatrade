
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

/**
 * Validates your custom admin session token (admin_sessions.token_hash).
 * Expects: Authorization: Bearer <token>
 */
export async function requireAdmin(req: NextRequest): Promise<{ adminSessionId: string } | null> {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7).trim();
  if (!token) return null;

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('id, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;

  if (data.expires_at) {
    const exp = new Date(data.expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) return null;
  }

  return { adminSessionId: data.id };
} 