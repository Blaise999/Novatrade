// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function resolveUserId(req: NextRequest): Promise<string | null> {
  // 1. x-user-id header (most reliable)
  const headerUserId = req.headers.get('x-user-id');
  if (headerUserId) return headerUserId;

  // 2. Query param
  const url = new URL(req.url);
  const paramUserId = url.searchParams.get('userId');
  if (paramUserId) return paramUserId;

  // 3. Auth token fallback
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (token) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      return data?.user?.id || null;
    }
  } catch {}

  return null;
}

// GET: List notifications or unread count
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ unreadCount: 0, data: [] });
  }

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') || 20)));

  try {
    if (unreadOnly) {
      const { count } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      return NextResponse.json({ unreadCount: count || 0 });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error('[Notifications GET]', err);
    return NextResponse.json({ data: [], unreadCount: 0 });
  }
}

// POST: Create a notification
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, type, title, message, data: notifData } = body;

    if (!user_id || !title) {
      return NextResponse.json({ error: 'user_id and title required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('notifications').insert({
      user_id,
      type: type || 'info',
      title,
      message: message || '',
      data: notifData || null,
    }).select().single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[Notifications POST]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// PATCH: Mark notification(s) as read
export async function PATCH(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, markAllRead } = body;
    const now = new Date().toISOString();

    if (markAllRead) {
      await supabaseAdmin
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', userId)
        .is('read_at', null);
      return NextResponse.json({ success: true });
    }

    if (id) {
      await supabaseAdmin
        .from('notifications')
        .update({ read_at: now })
        .eq('id', id)
        .eq('user_id', userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide id or markAllRead' }, { status: 400 });
  } catch (err: any) {
    console.error('[Notifications PATCH]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
