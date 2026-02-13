-- 012_fix_trades_deposits_balance.sql
-- ADDITIVE ONLY — no drops of data, safe to rerun
-- Fixes: trades table columns, deposits status constraint, indexes

-- ============================================
-- 1. TRADES TABLE: ensure all required columns exist
-- ============================================

-- Core columns
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS symbol TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS market_type TEXT DEFAULT 'crypto';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS side TEXT;         -- 'buy'/'sell'
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS quantity NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS leverage NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS entry_price NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS exit_price NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pnl NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS fees NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Alias / compatibility columns (used by different parts of the codebase)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS direction TEXT;       -- alias for side
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS profit_loss NUMERIC;  -- alias for pnl
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pnl_percentage NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pair TEXT;           -- alias for symbol
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS asset_type TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS trade_type TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lot_size NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS stop_loss NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS take_profit NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS current_price NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS margin_used NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS payout_percent NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN DEFAULT FALSE;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS notes TEXT;

-- Remove any restrictive CHECK constraints on trades columns
DO $$ BEGIN
  ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_market_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.trades DROP CONSTRAINT IF EXISTS trades_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Sync pair<->symbol where one is NULL
UPDATE public.trades SET symbol = pair WHERE symbol IS NULL AND pair IS NOT NULL;
UPDATE public.trades SET pair = symbol WHERE pair IS NULL AND symbol IS NOT NULL;

-- Sync side<->direction where one is NULL
UPDATE public.trades SET side = direction WHERE side IS NULL AND direction IS NOT NULL;
UPDATE public.trades SET direction = side WHERE direction IS NULL AND side IS NOT NULL;

-- Sync pnl<->profit_loss
UPDATE public.trades SET profit_loss = pnl WHERE profit_loss IS NULL AND pnl IS NOT NULL;
UPDATE public.trades SET pnl = profit_loss WHERE pnl IS NULL AND profit_loss IS NOT NULL;

-- ============================================
-- 2. TRADES INDEXES (IF NOT EXISTS)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_market_type ON public.trades(market_type);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON public.trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_market ON public.trades(user_id, market_type);
CREATE INDEX IF NOT EXISTS idx_trades_user_status ON public.trades(user_id, status);

-- ============================================
-- 3. DEPOSITS TABLE: widen status CHECK to include 'completed' and 'failed'
--    (admin approval uses 'completed', admin rejection uses 'failed')
-- ============================================
DO $$ BEGIN
  ALTER TABLE public.deposits DROP CONSTRAINT IF EXISTS deposits_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE public.deposits ADD CONSTRAINT deposits_status_check
  CHECK (status IN (
    'pending', 'processing', 'confirmed', 'approved', 'completed',
    'rejected', 'failed', 'cancelled', 'expired'
  ));

-- Ensure deposits has all needed columns
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS processed_by UUID;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS payment_asset TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS address_shown TEXT;

-- ============================================
-- 4. Ensure pair index exists (referenced in migration 011 but pair column might have been missing)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trades_pair ON public.trades(pair);
