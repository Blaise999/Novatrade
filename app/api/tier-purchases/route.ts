/**
 * TIER PURCHASES API
 *
 * GET  /api/tier-purchases — list user's tier purchases
 * POST /api/tier-purchases — submit a new tier purchase request
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Valid tier definitions
const VALID_TIERS: Record<string, { level: number; code: string; price: number }> = {
  starter: { level: 1, code: 'starter', price: 500 },
  trader: { level: 2, code: 'trader', price: 1000 },
  professional: { level: 3, code: 'professional', price: 3000 },
  elite: { level: 4, code: 'elite', price: 5000 },
};

// ============================================
// GET — list user's purchases
// ============================================
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('tier_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, purchases: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================
// POST — submit new tier purchase
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      tierCode,
      txHash,
      amountPaid,
      currency,
      paymentAsset,
      paymentNetwork,
      addressShown,
    } = body as {
      userId: string;
      tierCode: string;
      txHash?: string;
      amountPaid?: number;
      currency?: string;
      paymentAsset?: string;
      paymentNetwork?: string;
      addressShown?: string;
    };

    if (!userId || !tierCode) {
      return NextResponse.json(
        { success: false, error: 'userId and tierCode are required' },
        { status: 400 }
      );
    }

    const tierDef = VALID_TIERS[tierCode.toLowerCase()];
    if (!tierDef) {
      return NextResponse.json(
        { success: false, error: `Invalid tier code: ${tierCode}. Valid: ${Object.keys(VALID_TIERS).join(', ')}` },
        { status: 400 }
      );
    }

    // Check for existing pending purchase
    const { data: pending } = await supabaseAdmin
      .from('tier_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pending) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending tier purchase. Please wait for it to be reviewed.' },
        { status: 409 }
      );
    }

    const priceAmount = amountPaid || tierDef.price;
    const bonusAmount = Math.round(priceAmount * 0.40 * 100) / 100;

    const { data, error } = await supabaseAdmin
      .from('tier_purchases')
      .insert({
        user_id: userId,
        tier_level: tierDef.level,
        tier_code: tierDef.code,
        price_amount: priceAmount,
        bonus_amount: bonusAmount,
        currency: currency || 'USD',
        payment_asset: paymentAsset || null,
        payment_network: paymentNetwork || null,
        address_shown: addressShown || null,
        tx_hash: txHash || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      purchase: data,
      message: `Tier purchase submitted! You'll receive +$${bonusAmount.toFixed(2)} trading credit upon approval.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
