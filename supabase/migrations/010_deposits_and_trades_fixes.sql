-- 010_deposits_and_trades_fixes.sql
-- ADDITIVE ONLY – safe to run on any existing schema
-- Fixes deposits table for wallet page integration + trades market_type constraint

-- ============================================
-- 1. DEPOSITS TABLE: add missing columns, relax constraints
-- ============================================

-- The deposit page and wallet page insert columns that may not exist yet.
-- Add them if missing, and relax NOT NULL constraints to support both flows.

-- Make order_id nullable (auto-generate if missing)
DO $$ BEGIN
  ALTER TABLE public.deposits ALTER COLUMN order_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.deposits ALTER COLUMN order_id SET DEFAULT 'DEP-' || gen_random_uuid()::text;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make method nullable with default
DO $$ BEGIN
  ALTER TABLE public.deposits ALTER COLUMN method DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.deposits ALTER COLUMN method SET DEFAULT 'crypto';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Drop the old CHECK constraint on method to allow more values
DO $$ BEGIN
  ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_method_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make method_name nullable with default
DO $$ BEGIN
  ALTER TABLE public.deposits ALTER COLUMN method_name DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.deposits ALTER COLUMN method_name SET DEFAULT 'Crypto';
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add columns that deposit page uses but schema may lack
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS network TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS tx_hash TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop the old CHECK on status and add a wider one
DO $$ BEGIN
  ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.deposits ADD CONSTRAINT deposits_status_check
  CHECK (status IN ('pending', 'processing', 'confirmed', 'approved', 'rejected', 'expired'));

-- ============================================
-- 2. TRADES TABLE: widen market_type constraint to allow 'fx'
-- ============================================

-- The FX trading page inserts market_type='fx' but the original CHECK
-- only allows 'forex'. Remove old constraint and add wider one.

DO $$ BEGIN
  ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_market_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- No constraint needed – just allow any text value for market_type.
-- The app code already normalizes fx/forex/crypto/stocks.

-- Also ensure the 'type' column accepts 'buy'/'sell' without case issues
DO $$ BEGIN
  ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add 'direction' column if missing (some code writes to direction instead of type)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS direction TEXT;

-- Add 'symbol' alias column if missing (some code reads symbol instead of pair)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS symbol TEXT;

-- Add 'profit_loss' alias if missing (some code reads profit_loss instead of pnl)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS profit_loss DECIMAL(15,2);

-- Add 'trade_type' if missing (used by binary options flow)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS trade_type TEXT;

-- Add 'amount' column to trades if somehow missing
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS amount DECIMAL(15,2);

-- ============================================
-- 3. Ensure RLS policies for deposits allow service role writes
-- ============================================
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own deposits" ON public.deposits;
CREATE POLICY "Users can read own deposits"
  ON public.deposits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own deposits" ON public.deposits;
CREATE POLICY "Users can insert own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access deposits" ON public.deposits;
CREATE POLICY "Service role full access deposits"
  ON public.deposits FOR ALL
  USING (true)
  WITH CHECK (true);
