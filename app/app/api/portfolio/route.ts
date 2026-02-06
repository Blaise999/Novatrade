// Portfolio Positions Sync API
// GET /api/portfolio - Get user portfolio positions
// POST /api/portfolio - Sync positions to database
// PATCH /api/portfolio - Update position (shield mode, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================
// Types
// ============================================

interface CryptoPosition {
  id?: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  totalCostBasis: number;
  shieldEnabled?: boolean;
  shieldSnapPrice?: number;
  shieldSnapValue?: number;
  shieldActivatedAt?: string;
}

// ============================================
// GET /api/portfolio - Get portfolio positions
// ============================================

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }
    
    const { data, error } = await supabaseAdmin
      .from('crypto_positions')
      .select('*')
      .eq('user_id', userId)
      .gt('quantity', 0)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Portfolio API] Fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Transform to frontend format
    const positions = (data || []).map(p => ({
      id: p.id,
      symbol: p.symbol,
      quantity: Number(p.quantity),
      averagePrice: Number(p.average_price),
      totalCostBasis: Number(p.total_cost_basis),
      shieldEnabled: p.shield_enabled,
      shieldSnapPrice: p.shield_snap_price ? Number(p.shield_snap_price) : null,
      shieldSnapValue: p.shield_snap_value ? Number(p.shield_snap_value) : null,
      shieldActivatedAt: p.shield_activated_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
    
    return NextResponse.json({
      success: true,
      positions,
      count: positions.length,
    });
  } catch (error: any) {
    console.error('[Portfolio API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/portfolio - Sync/update positions
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, positions } = body;
    
    if (!userId || !Array.isArray(positions)) {
      return NextResponse.json(
        { success: false, error: 'userId and positions array required' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    for (const position of positions) {
      const { symbol, quantity, averagePrice, totalCostBasis, shieldEnabled, shieldSnapPrice, shieldSnapValue, shieldActivatedAt } = position;
      
      if (!symbol || quantity === undefined) {
        results.push({ symbol, success: false, error: 'Invalid position data' });
        continue;
      }
      
      // Upsert position (insert or update)
      const { data, error } = await supabaseAdmin
        .from('crypto_positions')
        .upsert({
          user_id: userId,
          symbol,
          quantity,
          average_price: averagePrice || 0,
          total_cost_basis: totalCostBasis || 0,
          shield_enabled: shieldEnabled || false,
          shield_snap_price: shieldSnapPrice || null,
          shield_snap_value: shieldSnapValue || null,
          shield_activated_at: shieldActivatedAt || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,symbol',
        })
        .select()
        .single();
      
      if (error) {
        console.error(`[Portfolio API] Upsert error for ${symbol}:`, error);
        results.push({ symbol, success: false, error: error.message });
      } else {
        results.push({ symbol, success: true, id: data?.id });
      }
    }
    
    const allSuccess = results.every(r => r.success);
    
    console.log(`[Portfolio API] Synced ${results.filter(r => r.success).length}/${positions.length} positions`);
    
    return NextResponse.json({
      success: allSuccess,
      results,
      summary: {
        total: positions.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error: any) {
    console.error('[Portfolio API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync positions' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/portfolio - Update single position
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, positionId, symbol, updates } = body;
    
    if (!userId || (!positionId && !symbol)) {
      return NextResponse.json(
        { success: false, error: 'userId and (positionId or symbol) required' },
        { status: 400 }
      );
    }
    
    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    if (updates.averagePrice !== undefined) updateData.average_price = updates.averagePrice;
    if (updates.totalCostBasis !== undefined) updateData.total_cost_basis = updates.totalCostBasis;
    if (updates.shieldEnabled !== undefined) updateData.shield_enabled = updates.shieldEnabled;
    if (updates.shieldSnapPrice !== undefined) updateData.shield_snap_price = updates.shieldSnapPrice;
    if (updates.shieldSnapValue !== undefined) updateData.shield_snap_value = updates.shieldSnapValue;
    if (updates.shieldActivatedAt !== undefined) updateData.shield_activated_at = updates.shieldActivatedAt;
    
    let query = supabaseAdmin
      .from('crypto_positions')
      .update(updateData)
      .eq('user_id', userId);
    
    if (positionId) {
      query = query.eq('id', positionId);
    } else if (symbol) {
      query = query.eq('symbol', symbol);
    }
    
    const { data, error } = await query.select().single();
    
    if (error) {
      console.error('[Portfolio API] Update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      position: data,
    });
  } catch (error: any) {
    console.error('[Portfolio API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update position' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/portfolio - Close position
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const userId = request.headers.get('x-user-id');
    const positionId = searchParams.get('positionId');
    const symbol = searchParams.get('symbol');
    
    if (!userId || (!positionId && !symbol)) {
      return NextResponse.json(
        { success: false, error: 'userId and (positionId or symbol) required' },
        { status: 400 }
      );
    }
    
    // Don't actually delete - set quantity to 0 for history
    let query = supabaseAdmin
      .from('crypto_positions')
      .update({
        quantity: 0,
        shield_enabled: false,
        shield_snap_price: null,
        shield_snap_value: null,
        shield_activated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    
    if (positionId) {
      query = query.eq('id', positionId);
    } else if (symbol) {
      query = query.eq('symbol', symbol);
    }
    
    const { error } = await query;
    
    if (error) {
      console.error('[Portfolio API] Delete error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Position closed',
    });
  } catch (error: any) {
    console.error('[Portfolio API] DELETE Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to close position' },
      { status: 500 }
    );
  }
}
