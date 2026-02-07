// Trades API Routes
// GET /api/trades - Get user trades
// POST /api/trades - Create new trade
// GET /api/trades/[id] - Get specific trade
// PATCH /api/trades/[id] - Update trade (close early, etc.)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { TradeDb, BalanceDb, AdminSessionDb, type Trade } from '@/lib/db';
import crypto from 'crypto';

// ============================================
// IDEMPOTENCY PROTECTION
// Prevents duplicate trades on refresh/retry
// ============================================
const idempotencyCache = new Map<string, { tradeId: string; expiresAt: number }>();
const IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes

function checkIdempotency(key: string): string | null {
  const record = idempotencyCache.get(key);
  
  // Clean up expired entries periodically
  if (idempotencyCache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache.entries()) {
      if (now > v.expiresAt) idempotencyCache.delete(k);
    }
  }
  
  if (record && Date.now() < record.expiresAt) {
    return record.tradeId;
  }
  
  return null;
}

function setIdempotency(key: string, tradeId: string): void {
  idempotencyCache.set(key, {
    tradeId,
    expiresAt: Date.now() + IDEMPOTENCY_TTL,
  });
}

// ============================================
// GET /api/trades
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    // Get query params
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const asset = searchParams.get('asset');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get trades
    let trades = TradeDb.getByUserId(user.id);
    
    // Filter by status
    if (status) {
      trades = trades.filter(t => t.status === status);
    }
    
    // Filter by asset
    if (asset) {
      trades = trades.filter(t => t.asset === asset);
    }
    
    // Sort by date (newest first)
    trades.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
    
    // Paginate
    const total = trades.length;
    trades = trades.slice(offset, offset + limit);
    
    // Get stats
    const stats = TradeDb.getUserStats(user.id);
    
    return NextResponse.json({
      success: true,
      trades,
      stats,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('[Trades API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/trades
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      type,
      direction,
      asset,
      assetType,
      amount,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage = 1,
      duration = 60,
      payout = 85,
      sessionId,
      idempotencyKey, // Client-provided key for duplicate prevention
    } = body;
    
    // Check idempotency
    const clientIdempotencyKey = idempotencyKey || request.headers.get('x-idempotency-key');
    if (clientIdempotencyKey) {
      const existingTradeId = checkIdempotency(`${user.id}:${clientIdempotencyKey}`);
      if (existingTradeId) {
        // Return the existing trade instead of creating a duplicate
        const existingTrade = TradeDb.getById(existingTradeId);
        if (existingTrade) {
          console.log(`[Trades API] Idempotency hit: returning existing trade ${existingTradeId}`);
          return NextResponse.json({
            success: true,
            trade: existingTrade,
            message: 'Trade already processed (idempotent)',
            idempotent: true,
          });
        }
      }
    }
    
    // Generate server-side idempotency key if none provided
    // Based on user, asset, amount, direction, and timestamp window (5 second window)
    const timeWindow = Math.floor(Date.now() / 5000); // 5 second windows
    const serverIdempotencyKey = `${user.id}:${asset}:${amount}:${direction}:${timeWindow}`;
    const existingFromServer = checkIdempotency(serverIdempotencyKey);
    if (existingFromServer) {
      const existingTrade = TradeDb.getById(existingFromServer);
      if (existingTrade) {
        console.log(`[Trades API] Duplicate detected within 5s window: ${existingFromServer}`);
        return NextResponse.json({
          success: true,
          trade: existingTrade,
          message: 'Trade already processed (duplicate detected)',
          idempotent: true,
        });
      }
    }
    
    // Validation
    if (!type || !direction || !asset || !amount || !entryPrice) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be positive' },
        { status: 400 }
      );
    }
    
    // Check balance
    const balance = BalanceDb.get(user.id, 'USD');
    if (!balance || balance.available < amount) {
      return NextResponse.json(
        { success: false, error: 'Insufficient balance' },
        { status: 400 }
      );
    }
    
    // Deduct from balance
    BalanceDb.deductFunds(user.id, 'USD', amount, 'available');
    
    // Create trade
    const tradeId = `TRD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const trade = TradeDb.create({
      oderId: tradeId,
      type,
      direction,
      asset,
      assetType: assetType || 'crypto',
      amount,
      entryPrice,
      stopLoss,
      takeProfit,
      leverage,
      duration,
      payout,
      status: 'active',
      openedAt: new Date().toISOString(),
      userId: user.id,
      sessionId,
    });
    
    // Store idempotency keys
    if (clientIdempotencyKey) {
      setIdempotency(`${user.id}:${clientIdempotencyKey}`, trade.id);
    }
    setIdempotency(serverIdempotencyKey, trade.id);
    
    return NextResponse.json({
      success: true,
      trade,
      message: 'Trade opened successfully',
    });
  } catch (error: any) {
    console.error('[Trades API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/trades (for closing trades)
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const { user, error } = await authenticateRequest(authHeader);
    
    if (!user) {
      return NextResponse.json({ success: false, error }, { status: 401 });
    }
    
    const body = await request.json();
    const { tradeId, action, exitPrice } = body;
    
    if (!tradeId || !action) {
      return NextResponse.json(
        { success: false, error: 'Trade ID and action required' },
        { status: 400 }
      );
    }
    
    // Get trade
    const trade = TradeDb.getById(tradeId);
    if (!trade) {
      return NextResponse.json(
        { success: false, error: 'Trade not found' },
        { status: 404 }
      );
    }
    
    // Verify ownership
    if (trade.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    if (action === 'close') {
      if (trade.status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'Trade is not active' },
          { status: 400 }
        );
      }
      
      // Calculate profit/loss
      const priceChange = exitPrice - trade.entryPrice;
      const isWin = (trade.direction === 'up' && priceChange > 0) || 
                    (trade.direction === 'down' && priceChange < 0);
      
      let profit: number;
      let status: Trade['status'];
      
      if (isWin) {
        profit = trade.amount * (trade.payout / 100);
        status = 'won';
        // Return investment + profit
        BalanceDb.addFunds(user.id, 'USD', trade.amount + profit);
      } else {
        profit = -trade.amount;
        status = 'lost';
        // Loss - amount already deducted
      }
      
      // Update trade
      const updatedTrade = TradeDb.update(tradeId, {
        exitPrice,
        profit,
        status,
        closedAt: new Date().toISOString(),
      });
      
      return NextResponse.json({
        success: true,
        trade: updatedTrade,
        result: {
          isWin,
          profit,
          newBalance: BalanceDb.get(user.id, 'USD')?.available || 0,
        },
      });
    }
    
    if (action === 'cancel') {
      if (trade.status !== 'pending') {
        return NextResponse.json(
          { success: false, error: 'Can only cancel pending trades' },
          { status: 400 }
        );
      }
      
      // Refund
      BalanceDb.addFunds(user.id, 'USD', trade.amount);
      
      const updatedTrade = TradeDb.update(tradeId, {
        status: 'cancelled',
        closedAt: new Date().toISOString(),
      });
      
      return NextResponse.json({
        success: true,
        trade: updatedTrade,
        message: 'Trade cancelled and refunded',
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Trades API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
