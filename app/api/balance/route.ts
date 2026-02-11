// Atomic Balance Operations API
// POST /api/balance/update - Atomic balance update with transaction logging
// GET /api/balance - Get current balance
// POST /api/balance/transfer - Transfer between accounts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client (server-side only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================
// Types
// ============================================

interface AtomicBalanceResult {
  success: boolean;
  balance_before?: number;
  balance_after?: number;
  transaction_id?: string;
  error?: string;
}

// ============================================
// GET /api/balance - Get user balance
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
      .from('users')
      .select('balance_available, balance_bonus, total_deposited, total_withdrawn')
      .eq('id', userId)
      .single();
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      balance: {
        available: Number(data.balance_available || 0),
        bonus: Number(data.balance_bonus || 0),
        totalDeposited: Number(data.total_deposited || 0),
        totalWithdrawn: Number(data.total_withdrawn || 0),
        total: Number(data.balance_available || 0) + Number(data.balance_bonus || 0),
      },
    });
  } catch (error: any) {
    console.error('[Balance API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/balance - Atomic balance update
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      amount, 
      type, 
      description, 
      referenceId,
      adminId,
      idempotencyKey 
    } = body;
    
    // Validation
    if (!userId || amount === undefined || !type) {
      return NextResponse.json(
        { success: false, error: 'userId, amount, and type are required' },
        { status: 400 }
      );
    }
    
    const validTypes = ['deposit', 'withdrawal', 'trade_open', 'trade_close', 'bonus', 'adjustment', 'fee', 'reversal', 'tier_bonus'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Check idempotency key if provided
    if (idempotencyKey) {
      const { data: existingKey } = await supabaseAdmin
        .from('idempotency_keys')
        .select('response_body')
        .eq('key', idempotencyKey)
        .eq('user_id', userId)
        .single();
      
      if (existingKey?.response_body) {
        console.log(`[Balance API] Idempotency hit for key: ${idempotencyKey}`);
        return NextResponse.json(existingKey.response_body);
      }
    }
    
    // Call atomic database function
    const { data, error } = await supabaseAdmin.rpc('update_user_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_description: description || null,
      p_reference_id: referenceId || null,
      p_admin_id: adminId || null,
    });
    
    if (error) {
      console.error('[Balance API] Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    const result = data as AtomicBalanceResult;
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Operation failed' },
        { status: 400 }
      );
    }
    
    const response = {
      success: true,
      balanceBefore: result.balance_before,
      balanceAfter: result.balance_after,
      transactionId: result.transaction_id,
      amount,
      type,
    };
    
    // Store idempotency response if key provided
    if (idempotencyKey) {
      await supabaseAdmin
        .from('idempotency_keys')
        .upsert({
          key: idempotencyKey,
          user_id: userId,
          operation_type: 'balance_update',
          response_status: 200,
          response_body: response,
        });
    }
    
    console.log(`[Balance API] ✅ ${type}: ${amount >= 0 ? '+' : ''}${amount} | ${result.balance_before} → ${result.balance_after}`);
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('[Balance API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update balance' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/balance - Batch balance operations
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { operations } = body;
    
    if (!Array.isArray(operations) || operations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Operations array required' },
        { status: 400 }
      );
    }
    
    if (operations.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 operations per batch' },
        { status: 400 }
      );
    }
    
    const results = [];
    
    // Process each operation atomically
    for (const op of operations) {
      const { data, error } = await supabaseAdmin.rpc('update_user_balance', {
        p_user_id: op.userId,
        p_amount: op.amount,
        p_type: op.type,
        p_description: op.description || null,
        p_reference_id: op.referenceId || null,
        p_admin_id: op.adminId || null,
      });
      
      if (error) {
        results.push({ success: false, error: error.message, operation: op });
      } else {
        results.push({ success: true, ...data, operation: op });
      }
    }
    
    const allSuccess = results.every(r => r.success);
    
    return NextResponse.json({
      success: allSuccess,
      results,
      summary: {
        total: operations.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
    
  } catch (error: any) {
    console.error('[Balance API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Batch operation failed' },
      { status: 500 }
    );
  }
}
