/**
 * BALANCE API
 * ===========
 * 
 * Single source of truth for user balance.
 * GET /api/balance - Returns the current balance from Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const userId = request.headers.get('x-user-id');
  if (userId) return userId;
  
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  
  try {
    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.auth.getUser(token);
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('users')
      .select('balance_available, balance_bonus, total_deposited')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Also get active FX trades to calculate unrealized P/L
    const { data: activeTrades } = await supabase
      .from('trades')
      .select('investment, floating_pnl')
      .eq('user_id', userId)
      .eq('market_type', 'fx')
      .in('status', ['open', 'active', 'pending']);
    
    const totalInvested = (activeTrades || []).reduce(
      (sum, t) => sum + Number(t.investment || 0),
      0
    );
    
    const totalUnrealizedPnL = (activeTrades || []).reduce(
      (sum, t) => sum + Number(t.floating_pnl || 0),
      0
    );
    
    const balance = Number(data.balance_available) || 0;
    const bonus = Number(data.balance_bonus) || 0;
    const totalDeposited = Number(data.total_deposited) || 0;
    
    return NextResponse.json({
      success: true,
      balance,
      bonus,
      totalDeposited,
      totalInvested,
      totalUnrealizedPnL,
      equity: balance + totalUnrealizedPnL,
      available: balance, // For backwards compatibility
    });
    
  } catch (error: any) {
    console.error('[Balance GET]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
