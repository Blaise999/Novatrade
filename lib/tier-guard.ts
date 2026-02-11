/**
 * TIER GUARD — Shared tier access control
 *
 * Client: hasTierAccess(userTierLevel, requiredLevel)
 * Server: requireTier(req, requiredLevel) → 403 if denied
 *
 * Required gates:
 * - Trading + Shield:    tier >= 1 AND active
 * - DCA Bots:            tier >= 2 AND active
 * - GridWarrior Bots:    tier >= 3 AND active
 * - Elite features:      tier >= 4 AND active
 */

// ============================================
// TYPES
// ============================================

export interface TierUser {
  tier_level: number;
  tier_active: boolean;
}

export type FeatureKey =
  | 'trading'
  | 'shield'
  | 'dca_bots'
  | 'grid_bots'
  | 'trading_bots'
  | 'ai_assistant'
  | 'elite';

// ============================================
// FEATURE → MINIMUM TIER MAPPING
// ============================================

export const FEATURE_TIER_MAP: Record<FeatureKey, number> = {
  trading: 1,
  shield: 1,
  dca_bots: 2,
  grid_bots: 3,
  trading_bots: 3,
  ai_assistant: 3,
  elite: 4,
};

export const TIER_NAMES: Record<number, string> = {
  0: 'Basic',
  1: 'Starter',
  2: 'Trader',
  3: 'Professional',
  4: 'Elite',
};

// ============================================
// CLIENT-SIDE GUARD
// ============================================

/**
 * Check if a user has access to a given tier level
 */
export function hasTierAccess(
  userTierLevel: number,
  requiredLevel: number,
  tierActive: boolean = true
): boolean {
  if (!tierActive && requiredLevel > 0) return false;
  return userTierLevel >= requiredLevel;
}

/**
 * Check if user can use a specific feature
 */
export function canUseFeature(
  userTierLevel: number,
  feature: FeatureKey,
  tierActive: boolean = true
): boolean {
  const required = FEATURE_TIER_MAP[feature];
  return hasTierAccess(userTierLevel, required, tierActive);
}

/**
 * Get the upgrade message for a denied feature
 */
export function getUpgradeMessage(feature: FeatureKey): string {
  const required = FEATURE_TIER_MAP[feature];
  const tierName = TIER_NAMES[required] || `Tier ${required}`;

  const featureLabels: Record<FeatureKey, string> = {
    trading: 'live trading',
    shield: 'Shield protection',
    dca_bots: 'DCA Bots',
    grid_bots: 'GridWarrior Bots',
    trading_bots: 'Trading Bots',
    ai_assistant: 'AI Assistant',
    elite: 'Elite features',
  };

  return `Upgrade required: You need ${tierName} (Tier ${required}) to use ${featureLabels[feature]}.`;
}

// ============================================
// SERVER-SIDE GUARD (for API routes)
// ============================================

import { createClient } from '@supabase/supabase-js';

const getAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

/**
 * Server-side tier check — returns { ok, user, error, status }
 * Use in API routes to hard-gate endpoints.
 */
export async function requireTier(
  userId: string,
  requiredLevel: number
): Promise<{
  ok: boolean;
  tierLevel?: number;
  tierActive?: boolean;
  error?: string;
  status?: number;
}> {
  if (!userId) {
    return { ok: false, error: 'User ID required', status: 401 };
  }

  const supabaseAdmin = getAdminClient();

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('tier_level, tier_active')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return { ok: false, error: 'User not found', status: 404 };
  }

  const tierLevel = Number(user.tier_level ?? 0);
  const tierActive = Boolean(user.tier_active);

  if (!hasTierAccess(tierLevel, requiredLevel, tierActive)) {
    const tierName = TIER_NAMES[requiredLevel] || `Tier ${requiredLevel}`;
    return {
      ok: false,
      tierLevel,
      tierActive,
      error: `Upgrade required: ${tierName} (Tier ${requiredLevel}) needed. Your current tier: ${TIER_NAMES[tierLevel] || 'Basic'}.`,
      status: 403,
    };
  }

  return { ok: true, tierLevel, tierActive };
}

/**
 * Convenience: require feature by name
 */
export async function requireFeature(
  userId: string,
  feature: FeatureKey
): Promise<ReturnType<typeof requireTier>> {
  return requireTier(userId, FEATURE_TIER_MAP[feature]);
}

// ============================================
// BONUS CALCULATION
// ============================================

export const TIER_BONUS_PERCENT = 0.40; // 40%

export function calculateTierBonus(priceAmount: number): number {
  return Math.round(priceAmount * TIER_BONUS_PERCENT * 100) / 100;
}
