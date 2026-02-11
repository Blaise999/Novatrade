-- ============================================
-- SAFE ADDITIVE MIGRATION: Tier Purchase System
-- NO drops, NO deletes, NO destructive operations
-- ============================================

-- 1) Add tier columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_level integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_active boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_code text DEFAULT 'basic';
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_activated_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text;

-- 2) Create tier_purchases table
CREATE TABLE IF NOT EXISTS tier_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  tier_level integer NOT NULL CHECK (tier_level BETWEEN 1 AND 4),
  tier_code text NOT NULL CHECK (tier_code IN ('starter','trader','professional','elite')),
  price_amount numeric NOT NULL CHECK (price_amount > 0),
  bonus_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  payment_asset text,
  payment_network text,
  address_shown text,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_at timestamptz,
  approved_by uuid,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_tier_purchases_user_id ON tier_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_purchases_status ON tier_purchases(status);
CREATE INDEX IF NOT EXISTS idx_users_tier_level ON users(tier_level);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- 4) Add referral_reward_paid column to referrals
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_paid boolean DEFAULT false;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_amount numeric DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_trigger text;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_paid_at timestamptz;

-- 5) Add columns to airdrop_claims for enhanced tracking
ALTER TABLE airdrop_claims ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;
ALTER TABLE airdrop_claims ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE airdrop_claims ADD COLUMN IF NOT EXISTS merkle_proof jsonb DEFAULT '[]'::jsonb;
ALTER TABLE airdrop_claims ADD COLUMN IF NOT EXISTS signature text;

-- 6) RLS Policies (safe - uses IF NOT EXISTS pattern via DO blocks)

-- tier_purchases: users can read own, admins can read all
DO $$ BEGIN
  ALTER TABLE tier_purchases ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tier_purchases_select_own ON tier_purchases
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tier_purchases_insert_own ON tier_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role can do everything (admin operations go through service role)
-- This is implicit with supabaseAdmin client
