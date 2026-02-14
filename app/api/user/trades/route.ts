/**
 * USER TRADE HISTORY API (SECURE)
 * GET /api/user/trades — list signed-in user's trades from Supabase
 *
 * - Uses Authorization Bearer token to identify user (NO x-user-id trust)
 * - Uses service role to read trades even if RLS is strict
 * - NO POST/PATCH here (opening/closing must go through /api/trades atomic RPC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '@/lib/auth';


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { user, error: authErr } = await authenticateRequest(authHeader);

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: authErr || 'Please sign in to view your trades.' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);

    const status = url.searchParams.get('status') || 'all';
    const market = url.searchParams.get('market') || 'all';
    const search = (url.searchParams.get('search') || '').trim();

    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') || 20)));

    let query = supabaseAdmin
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      // prefer opened_at (your fx system), fallback to created_at if you still have it
      .order('opened_at', { ascending: false });

    // Market filter (UI sends: crypto | fx | stocks)
    if (market !== 'all') query = query.eq('market_type', market);

    // Search
    if (search) {
      // NOTE: keep simple; avoid special chars breaking `or(...)`
      const safe = search.replace(/[(),]/g, ' ').trim();
      if (safe) query = query.or(`pair.ilike.%${safe}%,symbol.ilike.%${safe}%,asset.ilike.%${safe}%`);
    }

    // Status filter (match your FX statuses)
    if (status === 'open') {
      query = query.in('status', ['open', 'pending', 'active']);
    } else if (status === 'won') {
      query = query.eq('status', 'won');
    } else if (status === 'lost') {
      query = query.eq('status', 'lost');
    } else if (status === 'closed') {
      query = query.in('status', ['closed', 'won', 'lost', 'liquidated', 'stopped_out', 'take_profit']);
    } else if (status === 'cancelled') {
      query = query.in('status', ['cancelled', 'expired']);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      trades: data || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (err: any) {
    console.error('[User Trades GET]', err);
    return NextResponse.json(
      { success: false, error: 'Could not load your trades. Please try again.' },
      { status: 500 }
    );
  }
}

// IMPORTANT: block POST/PATCH here to prevent balance cheating.
// Opening/closing trades must go through /api/trades (atomic).
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'Use POST /api/trades to open trades.' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { success: false, error: 'Use PATCH /api/trades to close trades.' },
    { status: 405 }
  );
}
