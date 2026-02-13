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
    const userId = request.headers.get('x-user-id') || request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ success: true, deposits: data || [] });
  } catch (err: any) {
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

    if (!userId || !amount || amount <= 0) {
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

    const { data, error } = await supabaseAdmin
      .from('deposits')
      .insert({
        user_id: userId,
        amount: Number(amount),
        currency: currency || 'USD',
        method: method || 'crypto',
        method_name: methodName || `Crypto Deposit (${network || 'default'})`,
        network: network || null,
        tx_hash: txHash || null,
        payment_asset: paymentAsset || null,
        address_shown: addressShown || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      deposit: data,
      message: `Deposit of $${Number(amount).toFixed(2)} submitted! It will be reviewed within 1-24 hours.`,
    });
  } catch (err: any) {
    console.error('[Deposits POST]', err);
    return NextResponse.json(
      { success: false, error: 'Something went wrong submitting your deposit. Please try again.' },
      { status: 500 }
    );
  }
}
