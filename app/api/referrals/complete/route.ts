import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function normalizeRef(ref?: string) {
  return (ref || '').trim().toUpperCase();
}

// Referral commission rate (5%)
const REFERRAL_COMMISSION_RATE = 0.05;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    const ref = normalizeRef(body.ref);
    const tierAmount = Number(body.tierAmount || 0);
    const triggerType = String(body.trigger || 'signup'); // 'signup' | 'tier_purchase'

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 });
    }

    // Referral is NOT compulsory
    if (!ref) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Find referrer by referral code
    let referrerId: string | null = null;

    // Check referral_codes table first
    const { data: codeData } = await supabaseAdmin
      .from('referral_codes')
      .select('user_id')
      .eq('code', ref)
      .maybeSingle();

    if (codeData?.user_id) {
      referrerId = codeData.user_id;
    } else {
      // Fallback: check users table
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('referral_code', ref)
        .maybeSingle();

      if (userData?.id) {
        referrerId = userData.id;
      }
    }

    if (!referrerId) {
      return NextResponse.json({ ok: true, applied: false, reason: 'Invalid referral code' });
    }

    // Don't allow self-referral
    if (referrerId === userId) {
      return NextResponse.json({ ok: true, applied: false, reason: 'Self-referral not allowed' });
    }

    // Check if referral record already exists
    const { data: existingRef } = await supabaseAdmin
      .from('referrals')
      .select('id, reward_paid')
      .eq('referrer_id', referrerId)
      .eq('referred_user_id', userId)
      .maybeSingle();

    if (triggerType === 'signup') {
      // Just create the referral record (no reward yet)
      if (!existingRef) {
        const { error: insertError } = await supabaseAdmin.from('referrals').insert({
          referrer_id: referrerId,
          referred_user_id: userId,
          reward_paid: false,
          reward_amount: 0,
          reward_trigger: 'pending_tier',
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          return NextResponse.json({ ok: true, applied: false, reason: insertError.message });
        }
      }

      return NextResponse.json({ ok: true, applied: true, referrerId });
    }

    // Tier purchase trigger - pay the reward
    if (triggerType === 'tier_purchase' && tierAmount > 0) {
      const rewardAmount = tierAmount * REFERRAL_COMMISSION_RATE;

      if (existingRef && !existingRef.reward_paid) {
        // Update existing referral with reward
        await supabaseAdmin
          .from('referrals')
          .update({
            reward_paid: true,
            reward_amount: rewardAmount,
            reward_trigger: 'tier_purchase',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRef.id);

        // Credit referrer's balance
        const { data: referrerData } = await supabaseAdmin
          .from('users')
          .select('balance_available')
          .eq('id', referrerId)
          .single();

        const currentBalance = Number(referrerData?.balance_available || 0);
        const newBalance = currentBalance + rewardAmount;

        await supabaseAdmin
          .from('users')
          .update({
            balance_available: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', referrerId);

        // Create transaction record
        await supabaseAdmin.from('transactions').insert({
          user_id: referrerId,
          type: 'referral_bonus',
          amount: rewardAmount,
          description: `Referral bonus for tier purchase`,
          reference_type: 'referral',
          reference_id: existingRef.id,
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          applied: true,
          rewardPaid: true,
          rewardAmount,
          referrerId,
        });
      } else if (!existingRef) {
        // Create new referral with reward paid
        const { data: newRef, error: insertError } = await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: referrerId,
            referred_user_id: userId,
            reward_paid: true,
            reward_amount: rewardAmount,
            reward_trigger: 'tier_purchase',
            created_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) {
          return NextResponse.json({ ok: true, applied: false, reason: insertError.message });
        }

        // Credit referrer's balance
        const { data: referrerData } = await supabaseAdmin
          .from('users')
          .select('balance_available')
          .eq('id', referrerId)
          .single();

        const currentBalance = Number(referrerData?.balance_available || 0);
        const newBalance = currentBalance + rewardAmount;

        await supabaseAdmin
          .from('users')
          .update({
            balance_available: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', referrerId);

        // Create transaction record
        await supabaseAdmin.from('transactions').insert({
          user_id: referrerId,
          type: 'referral_bonus',
          amount: rewardAmount,
          description: `Referral bonus for tier purchase`,
          reference_type: 'referral',
          reference_id: newRef?.id,
          status: 'completed',
          created_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          applied: true,
          rewardPaid: true,
          rewardAmount,
          referrerId,
        });
      }
    }

    // Try the RPC if available (legacy support)
    try {
      const { data, error } = await supabaseAdmin.rpc('complete_referral', {
        p_referred_user_id: userId,
        p_ref: ref,
      });

      if (error) {
        return NextResponse.json({ ok: true, applied: false, reason: error.message });
      }

      return NextResponse.json(data ?? { ok: true });
    } catch {
      return NextResponse.json({ ok: true, applied: true, referrerId });
    }
  } catch (e: any) {
    // Never break signup for referral completion errors
    return NextResponse.json({ ok: true, applied: false, reason: e?.message || 'unknown' });
  }
}
