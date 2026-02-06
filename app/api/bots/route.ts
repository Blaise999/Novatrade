/**
 * BOT API ROUTES
 *
 * GET  /api/bots            — list user's bots
 * GET  /api/bots?id=xxx     — single bot detail (config + levels + orders)
 * POST /api/bots            — create DCA or Grid bot
 * PATCH /api/bots           — start / stop / pause
 * DELETE /api/bots?id=xxx   — delete a stopped bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ============================================
// GET
// ============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = request.headers.get('x-user-id') || searchParams.get('userId');
    const botId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 });
    }

    // Single bot detail
    if (botId) {
      const { data: bot, error } = await supabaseAdmin
        .from('trading_bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single();

      if (error || !bot) {
        return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
      }

      // Attach config
      if (bot.bot_type === 'dca') {
        const { data: cfg } = await supabaseAdmin.from('dca_bot_config').select('*').eq('bot_id', botId).single();
        bot.dca_config = cfg;
      } else {
        const { data: cfg } = await supabaseAdmin.from('grid_bot_config').select('*').eq('bot_id', botId).single();
        bot.grid_config = cfg;
        const { data: levels } = await supabaseAdmin.from('grid_levels').select('*').eq('bot_id', botId).order('level_index');
        bot.grid_levels = levels ?? [];
      }

      // Recent orders
      const { data: orders } = await supabaseAdmin
        .from('bot_orders')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(50);
      bot.orders = orders ?? [];

      // Activity
      const { data: activity } = await supabaseAdmin
        .from('bot_activity_log')
        .select('*')
        .eq('bot_id', botId)
        .order('created_at', { ascending: false })
        .limit(30);
      bot.activity = activity ?? [];

      return NextResponse.json({ success: true, bot });
    }

    // List all bots
    const { data: bots, error } = await supabaseAdmin
      .from('trading_bots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bots: bots ?? [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ============================================
// POST — Create
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, botType } = body;

    if (!userId || !botType) {
      return NextResponse.json({ success: false, error: 'userId and botType required' }, { status: 400 });
    }

    if (botType === 'dca') {
      const { name, pair, orderAmount, frequency, takeProfitPct, stopLossPct,
        trailingTpEnabled, trailingTpDeviation,
        safetyOrdersEnabled, maxSafetyOrders, safetyOrderSize,
        safetyOrderStepPct, safetyOrderStepScale, safetyOrderVolumeScale } = body;

      if (!pair || !orderAmount) {
        return NextResponse.json({ success: false, error: 'pair and orderAmount required' }, { status: 400 });
      }

      const { data: bot, error: botErr } = await supabaseAdmin.from('trading_bots').insert({
        user_id: userId, bot_type: 'dca', name: name || `DCA ${pair}`, pair, status: 'stopped',
      }).select().single();

      if (botErr) return NextResponse.json({ success: false, error: botErr.message }, { status: 500 });

      const { data: cfg, error: cfgErr } = await supabaseAdmin.from('dca_bot_config').insert({
        bot_id: bot.id, order_amount: orderAmount, frequency: frequency || '4h',
        take_profit_pct: takeProfitPct ?? 3.0, stop_loss_pct: stopLossPct ?? null,
        trailing_tp_enabled: trailingTpEnabled ?? false, trailing_tp_deviation: trailingTpDeviation ?? 1.0,
        safety_orders_enabled: safetyOrdersEnabled ?? false, max_safety_orders: maxSafetyOrders ?? 5,
        safety_order_size: safetyOrderSize ?? orderAmount, safety_order_step_pct: safetyOrderStepPct ?? 2.0,
        safety_order_step_scale: safetyOrderStepScale ?? 1.0, safety_order_volume_scale: safetyOrderVolumeScale ?? 1.5,
      }).select().single();

      await supabaseAdmin.from('bot_activity_log').insert({ bot_id: bot.id, action: 'created', details: { type: 'dca' } });
      return NextResponse.json({ success: true, bot: { ...bot, dca_config: cfg } });
    }

    if (botType === 'grid') {
      const { name, pair, upperPrice, lowerPrice, gridCount, gridType, totalInvestment,
        strategy, stopUpperPrice, stopLowerPrice } = body;

      if (!pair || !upperPrice || !lowerPrice || !gridCount || !totalInvestment) {
        return NextResponse.json({ success: false, error: 'pair, upperPrice, lowerPrice, gridCount, totalInvestment required' }, { status: 400 });
      }

      const { data: bot, error: botErr } = await supabaseAdmin.from('trading_bots').insert({
        user_id: userId, bot_type: 'grid', name: name || `Grid ${pair}`, pair, status: 'stopped',
        invested_amount: totalInvestment,
      }).select().single();

      if (botErr) return NextResponse.json({ success: false, error: botErr.message }, { status: 500 });

      const perGrid = +(totalInvestment / gridCount).toFixed(8);
      const { data: cfg } = await supabaseAdmin.from('grid_bot_config').insert({
        bot_id: bot.id, upper_price: upperPrice, lower_price: lowerPrice,
        grid_count: gridCount, grid_type: gridType || 'arithmetic',
        total_investment: totalInvestment, per_grid_amount: perGrid,
        strategy: strategy || 'neutral',
        stop_upper_price: stopUpperPrice ?? null, stop_lower_price: stopLowerPrice ?? null,
      }).select().single();

      // Generate levels
      const prices = (gridType === 'geometric')
        ? genGeoGrid(lowerPrice, upperPrice, gridCount)
        : genArithGrid(lowerPrice, upperPrice, gridCount);

      for (let i = 0; i < prices.length; i++) {
        await supabaseAdmin.from('grid_levels').insert({ bot_id: bot.id, level_index: i, price: prices[i] });
      }

      const { data: levels } = await supabaseAdmin.from('grid_levels').select('*').eq('bot_id', bot.id).order('level_index');
      await supabaseAdmin.from('bot_activity_log').insert({ bot_id: bot.id, action: 'created', details: { type: 'grid', gridCount } });

      return NextResponse.json({ success: true, bot: { ...bot, grid_config: cfg, grid_levels: levels } });
    }

    return NextResponse.json({ success: false, error: 'Invalid botType' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ============================================
// PATCH — Start / Stop / Pause
// ============================================
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, botId, action } = body;

    if (!userId || !botId || !action) {
      return NextResponse.json({ success: false, error: 'userId, botId, action required' }, { status: 400 });
    }

    const { data: bot } = await supabaseAdmin.from('trading_bots').select('id, user_id, status').eq('id', botId).eq('user_id', userId).single();
    if (!bot) return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });

    const validActions = ['start', 'stop', 'pause'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: 'action must be start, stop, or pause' }, { status: 400 });
    }

    const statusMap: Record<string, string> = { start: 'running', stop: 'stopped', pause: 'paused' };
    const extra: Record<string, any> = {};
    if (action === 'start') extra.started_at = new Date().toISOString();
    if (action === 'stop') extra.stopped_at = new Date().toISOString();

    await supabaseAdmin.from('trading_bots').update({ status: statusMap[action], ...extra }).eq('id', botId);
    await supabaseAdmin.from('bot_activity_log').insert({ bot_id: botId, action, details: {} });

    return NextResponse.json({ success: true, status: statusMap[action] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ============================================
// DELETE
// ============================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const botId = searchParams.get('id');
    const userId = request.headers.get('x-user-id') || searchParams.get('userId');

    if (!botId || !userId) {
      return NextResponse.json({ success: false, error: 'id and userId required' }, { status: 400 });
    }

    const { data: bot } = await supabaseAdmin.from('trading_bots').select('id, status').eq('id', botId).eq('user_id', userId).single();
    if (!bot) return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
    if (bot.status === 'running') {
      return NextResponse.json({ success: false, error: 'Stop bot before deleting' }, { status: 400 });
    }

    // Cascade handles children
    await supabaseAdmin.from('trading_bots').delete().eq('id', botId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ============================================
// Grid helpers (duplicated for server-side)
// ============================================
function genArithGrid(lo: number, hi: number, n: number): number[] {
  const step = (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, i) => +(lo + i * step).toFixed(8));
}
function genGeoGrid(lo: number, hi: number, n: number): number[] {
  const r = Math.pow(hi / lo, 1 / (n - 1));
  return Array.from({ length: n }, (_, i) => +(lo * Math.pow(r, i)).toFixed(8));
}
