/**
 * USER TRADE HISTORY API
 *
 * GET /api/user/trades — list user's trades from Supabase
 * Uses service role key so it works even if client JWT expired
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = request.headers.get('x-user-id') || url.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Please sign in to view your trades.' },
        { status: 401 }
      );
    }

    const status = url.searchParams.get('status') || 'all';
    const market = url.searchParams.get('market') || 'all';
    const search = url.searchParams.get('search') || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const pageSize = Math.min(50, Math.max(5, Number(url.searchParams.get('pageSize') || 20)));

    let query = supabaseAdmin
      .from('trades')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Market filter
    if (market !== 'all') {
      query = query.eq('market_type', market);
    }

    // Search
    if (search) {
      query = query.or(`pair.ilike.%${search}%,symbol.ilike.%${search}%`);
    }

    // Status filter
    if (status === 'open') {
      query = query.in('status', ['open', 'pending', 'active']);
    } else if (status === 'won') {
      query = query.eq('status', 'won');
    } else if (status === 'lost') {
      query = query.eq('status', 'lost');
    } else if (status === 'closed') {
      query = query.in('status', ['closed', 'won', 'lost']);
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
