/**
 * USER DEPOSITS API
 *
 * POST /api/deposits — submit a new deposit (like tier-purchases)
 * GET  /api/deposits — list user's deposits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================
// GET — list user's deposits
// ============================================
export async function GET(request: NextRequest) {
  try {
    // Try multiple ways to get userId
    const userId = 
      request.headers.get('x-user-id') || 
      request.nextUrl.searchParams.get('userId') ||
      request.nextUrl.searchParams.get('user_id');
    
    if (!userId) {
      console.error('[Deposits GET] No user ID provided');
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Deposits GET] DB error:', error);
      throw error;
    }

    return NextResponse.json({ success: true, deposits: data || [] });
  } catch (err: any) {
    console.error('[Deposits GET] Error:', err);
    return NextResponse.json(
      { success: false, error: 'Could not load deposits. Please try again.' },
      { status: 500 }
    );
  }
}

// ============================================
// POST — submit new deposit
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      amount,
      currency,
      method,
      methodName,
      network,
      txHash,
      paymentAsset,
      addressShown,
    } = body as {
      userId: string;
      amount: number;
      currency?: string;
      method?: string;
      methodName?: string;
      network?: string;
      txHash?: string;
      paymentAsset?: string;
      addressShown?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required.' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid amount.' },
        { status: 400 }
      );
    }

    // Check for existing pending deposit (prevent spam)
    const { data: pending } = await supabaseAdmin
      .from('deposits')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (pending && pending.length >= 5) {
      return NextResponse.json(
        { success: false, error: 'You have too many pending deposits. Please wait for them to be reviewed.' },
        { status: 409 }
      );
    }

    // Build insert object - only include fields that exist in the table
    // Base fields that definitely exist
    const insertData: Record<string, any> = {
      user_id: userId,
      amount: Number(amount),
      currency: currency || 'USD',
      method: method || 'crypto',
      method_name: methodName || `Crypto Deposit (${network || 'default'})`,
      network: network || null,
      tx_hash: txHash || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Try to insert with new columns first
    let result = await supabaseAdmin
      .from('deposits')
      .insert({
        ...insertData,
        payment_asset: paymentAsset || null,
        address_shown: addressShown || null,
      })
      .select()
      .single();

    // If column error, try without the new columns
    if (result.error && (
      result.error.message?.includes('column') || 
      result.error.code === '42703' ||
      result.error.message?.includes('payment_asset') ||
      result.error.message?.includes('address_shown')
    )) {
      console.log('[Deposits POST] Column missing, using basic insert');
      result = await supabaseAdmin
        .from('deposits')
        .insert(insertData)
        .select()
        .single();
    }

    if (result.error) {
      console.error('[Deposits POST] Insert error:', result.error);
      return NextResponse.json(
        { success: false, error: result.error.message || 'Database error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deposit: result.data,
      message: `Deposit of $${Number(amount).toFixed(2)} submitted! It will be reviewed within 1-24 hours.`,
    });
  } catch (err: any) {
    console.error('[Deposits POST] Error:', err?.message || err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Something went wrong submitting your deposit. Please try again.' },
      { status: 500 }
    );
  }
}
