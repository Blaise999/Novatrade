/**
 * ADMIN TIER PURCHASES API
 *
 * GET   /api/admin/tier-purchases — list all (with filters)
 * PATCH /api/admin/tier-purchases — approve or reject
 *
 * On approval:
 *   1. tier_purchases.status = 'approved'
 *   2. users.tier_level, tier_active, tier_code updated
 *   3. Bonus credit (40% of price) added to balance_available
 *   4. Transaction logged in transactions table
 *   5. Referral reward triggered if applicable
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

// ============================================
// GET — list all tier purchases
// ============================================
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');

  let query = auth.supabaseAdmin
    .from('tier_purchases')
    .select('*, users(email, first_name, last_name, tier_level, tier_active)')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, purchases: data || [] });
}

// ============================================
// PATCH — approve or reject
// ============================================
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { purchaseId, action, rejectedReason } = body as {
      purchaseId: string;
      action: 'approve' | 'reject';
      rejectedReason?: string;
    };

    if (!purchaseId || !action) {
      return NextResponse.json(
        { success: false, error: 'purchaseId and action required' },
        { status: 400 }
      );
    }

    // Fetch the purchase
    const { data: purchase, error: fetchErr } = await auth.supabaseAdmin
      .from('tier_purchases')
      .select('*')
      .eq('id', purchaseId)
      .single();

    if (fetchErr || !purchase) {
      return NextResponse.json(
        { success: false, error: 'Purchase not found' },
        { status: 404 }
      );
    }

    if (purchase.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Purchase already ${purchase.status}` },
        { status: 409 }
      );
    }

    // ============================================
    // REJECT
    // ============================================
    if (action === 'reject') {
      await auth.supabaseAdmin
        .from('tier_purchases')
        .update({
          status: 'rejected',
          rejected_reason: rejectedReason || 'Rejected by admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchaseId);

      return NextResponse.json({
        success: true,
        message: 'Tier purchase rejected.',
      });
    }

    // ============================================
    // APPROVE
    // ============================================

    const tierLevel = Number(purchase.tier_level);
    const tierCode = String(purchase.tier_code);
    const priceAmount = Number(purchase.price_amount);
    const bonusAmount = Math.round(priceAmount * 0.40 * 100) / 100;
    const userId = String(purchase.user_id);
    const now = new Date().toISOString();

    // 1. Update tier_purchases status
    await auth.supabaseAdmin
      .from('tier_purchases')
      .update({
        status: 'approved',
        bonus_amount: bonusAmount,
        approved_at: now,
        approved_by: auth.adminId,
        updated_at: now,
      })
      .eq('id', purchaseId);

    // 2. Fetch current user balance
    const { data: userRow } = await auth.supabaseAdmin
      .from('users')
      .select('balance_available, balance_bonus, tier_level')
      .eq('id', userId)
      .single();

    const currentBalance = Number(userRow?.balance_available ?? 0);
    const currentBonus = Number(userRow?.balance_bonus ?? 0);
    const newBalance = currentBalance + bonusAmount;
    const newBonus = currentBonus + bonusAmount;

    // 3. Update user tier + credit bonus
    await auth.supabaseAdmin
      .from('users')
      .update({
        tier_level: tierLevel,
        tier_active: true,
        tier_code: tierCode,
        tier_activated_at: now,
        balance_available: newBalance,
        balance_bonus: newBonus,
        updated_at: now,
      })
      .eq('id', userId);

    // 4. Log transaction for the bonus
    await auth.supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'tier_bonus',
      amount: bonusAmount,
      currency: 'USD',
      balance_before: currentBalance,
      balance_after: newBalance,
      status: 'completed',
      reference_type: 'tier_purchase',
      reference_id: purchaseId,
      description: `Tier ${tierCode} purchase bonus (40% of $${priceAmount})`,
      admin_id: auth.adminId,
      metadata: {
        tier_level: tierLevel,
        tier_code: tierCode,
        price_amount: priceAmount,
        bonus_percent: 40,
      },
    });

    // 5. Log admin action
    await auth.supabaseAdmin.from('admin_logs').insert({
      admin_id: auth.adminId,
      action: 'tier_purchase_approved',
      action_category: 'tier',
      target_type: 'tier_purchase',
      target_id: purchaseId,
      old_values: { status: 'pending' },
      new_values: {
        status: 'approved',
        tier_level: tierLevel,
        bonus_credited: bonusAmount,
        user_id: userId,
      },
    });

    // 6. Trigger referral reward if this is user's first approved tier purchase
    try {
      const { data: prevPurchases } = await auth.supabaseAdmin
        .from('tier_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .neq('id', purchaseId);

      const isFirstPurchase = !prevPurchases || prevPurchases.length === 0;

      if (isFirstPurchase) {
        // Check if user was referred
        const { data: userFull } = await auth.supabaseAdmin
          .from('users')
          .select('referred_by')
          .eq('id', userId)
          .single();

        if (userFull?.referred_by) {
          const referrerId = String(userFull.referred_by);
          const referralReward = Math.round(priceAmount * 0.05 * 100) / 100; // 5% referral bonus

          // Credit referrer
          const { data: referrerRow } = await auth.supabaseAdmin
            .from('users')
            .select('balance_available')
            .eq('id', referrerId)
            .single();

          if (referrerRow) {
            const refBal = Number(referrerRow.balance_available ?? 0);
            await auth.supabaseAdmin
              .from('users')
              .update({ balance_available: refBal + referralReward })
              .eq('id', referrerId);

            // Log referral reward transaction
            await auth.supabaseAdmin.from('transactions').insert({
              user_id: referrerId,
              type: 'bonus',
              amount: referralReward,
              currency: 'USD',
              balance_before: refBal,
              balance_after: refBal + referralReward,
              status: 'completed',
              reference_type: 'referral_reward',
              description: `Referral reward: referred user purchased ${tierCode} tier`,
              metadata: { referred_user_id: userId, tier_code: tierCode },
            });

            // Update referral record
            await auth.supabaseAdmin
              .from('referrals')
              .update({
                reward_paid: true,
                reward_amount: referralReward,
                reward_trigger: 'first_tier_purchase',
                reward_paid_at: now,
              })
              .eq('referred_user_id', userId)
              .eq('referrer_id', referrerId);
          }
        }
      }
    } catch (refErr) {
      console.error('[Tier Approve] Referral reward error (non-fatal):', refErr);
    }

    return NextResponse.json({
      success: true,
      message: `Tier ${tierCode} approved. $${bonusAmount.toFixed(2)} bonus credited.`,
      details: {
        tierLevel,
        tierCode,
        bonusCredited: bonusAmount,
        newBalance,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Admin Tier Purchases] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
