// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user?.id || null;
}

// GET: List notifications (paginated) or unread count
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    console.error('[Notifications GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load notifications' }, { status: 500 });
  }
}

// POST: Create a notification (server-side use or internal)
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
    console.error('[Notifications POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Mark notification(s) as read
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

      return NextResponse.json({ success: true, message: 'All marked as read' });
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
    console.error('[Notifications PATCH] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
