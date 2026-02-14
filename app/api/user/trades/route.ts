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

/**
 * POST /api/user/trades — save a new trade (uses service role key, bypasses RLS)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = request.headers.get('x-user-id') || body.userId || body.user_id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 401 });
    }

    const now = new Date().toISOString();
    const direction = body.direction ?? body.side ?? 'buy';
    const pair = body.pair ?? body.symbol ?? '';
    const marketType = body.market_type ?? body.marketType ?? 'fx';

    const row: Record<string, any> = {
      ...(body.id ? { id: body.id } : {}),
      user_id: userId,
      market_type: marketType === 'forex' ? 'fx' : marketType,
      asset_type: body.asset_type ?? body.assetType ?? null,
      pair,
      symbol: pair,
      type: direction,
      direction,
      amount: Number(body.amount ?? body.quantity ?? 0) || 0,
      quantity: body.quantity ?? null,
      lot_size: body.lot_size ?? body.lotSize ?? null,
      leverage: body.leverage ?? null,
      entry_price: Number(body.entry_price ?? body.entryPrice ?? 0) || 0,
      stop_loss: body.stop_loss ?? body.stopLoss ?? null,
      take_profit: body.take_profit ?? body.takeProfit ?? null,
      status: body.status ?? 'open',
      opened_at: body.opened_at ?? body.openedAt ?? now,
      updated_at: now,
      is_simulated: body.is_simulated ?? body.isSimulated ?? null,
      notes: body.notes ?? null,
    };

    const base = body.id
      ? supabaseAdmin.from('trades').upsert(row, { onConflict: 'id' })
      : supabaseAdmin.from('trades').insert(row);

    const { data, error } = await base.select('*').single();
    if (error) throw error;

    return NextResponse.json({ success: true, trade: data });
  } catch (err: any) {
    console.error('[User Trades POST]', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to save trade' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/trades — close/update a trade (uses service role key, bypasses RLS)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = request.headers.get('x-user-id') || body.userId || body.user_id;
    const tradeId = body.tradeId ?? body.trade_id ?? body.id;

    if (!userId || !tradeId) {
      return NextResponse.json({ success: false, error: 'Missing userId or tradeId' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const patch: Record<string, any> = {
      exit_price: body.exit_price ?? body.exitPrice ?? null,
      closed_at: body.closed_at ?? body.closedAt ?? now,
      pnl: body.pnl ?? null,
      profit_loss: body.pnl ?? null,
      pnl_percentage: body.pnl_percent ?? body.pnlPercent ?? null,
      status: body.status ?? 'closed',
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from('trades')
      .update(patch)
      .eq('id', tradeId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, trade: data });
  } catch (err: any) {
    console.error('[User Trades PATCH]', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update trade' },
      { status: 500 }
    );
  }
}
