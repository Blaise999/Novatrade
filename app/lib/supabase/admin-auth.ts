import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function requireAdminSession(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) throw new Error('Missing admin token');

  const { data, error } = await supabaseAdmin
    .from('admin_sessions')
    .select('admin_id, expires_at, revoked_at')
    .eq('token', token)
    .single();

  if (error || !data) throw new Error('Invalid admin session');
  if (data.revoked_at) throw new Error('Session revoked');
  if (data.expires_at && new Date(data.expires_at) <= new Date()) throw new Error('Session expired');

  return { adminId: data.admin_id };
}
