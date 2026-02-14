-- 011_wallet_deposits_and_trades_aliases.sql
-- ADDITIVE ONLY — no drops, no destructive changes
-- Run after 010_deposits_and_trades_fixes.sql

-- =============================================
-- 1. DEPOSITS TABLE: ensure all columns exist for wallet page → admin flow
-- =============================================

-- method (crypto/bank/processor)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS method TEXT;

-- method_name (display name like "USDT TRC-20" or "Chase Bank")
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS method_name TEXT;

-- transaction_ref (user-entered reference)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS transaction_ref TEXT;

-- proof_url (screenshot/image URL)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- processed_by (admin user_id who approved/rejected)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS processed_by UUID;

-- processed_at (timestamp of admin action)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- admin_note (internal note from admin)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- rejection_reason (shown to user on reject)
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- updated_at
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Index for admin deposit list (status filter + newest first)
CREATE INDEX IF NOT EXISTS idx_deposits_status_created
  ON public.deposits(status, created_at DESC);

-- Index for user deposit history
CREATE INDEX IF NOT EXISTS idx_deposits_user_created
  ON public.deposits(user_id, created_at DESC);


-- =============================================
-- 2. TRADES TABLE: ensure alias columns exist for admin trades compatibility
-- =============================================

-- symbol (alias for pair — some code writes pair, admin reads symbol)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS symbol TEXT;

-- direction (alias for type — some code writes type, admin reads direction)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS direction TEXT;

-- Sync type<->direction where one is NULL
UPDATE public.trades SET type = direction WHERE type IS NULL AND direction IS NOT NULL;
UPDATE public.trades SET direction = type WHERE direction IS NULL AND type IS NOT NULL;

-- profit_loss (alias for pnl — some code writes pnl, admin reads profit_loss)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS profit_loss DECIMAL(15,2);

-- trade_type (used by binary options flow)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS trade_type TEXT;

-- side (long/short alias)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS side TEXT;

-- lot_size
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS lot_size DECIMAL(15,4);

-- current_price (for live P&L calculation)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS current_price DECIMAL(24,8);

-- stop_loss / take_profit
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(24,8);
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS take_profit DECIMAL(24,8);

-- margin_used
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS margin_used DECIMAL(15,2);

-- fees
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS fees DECIMAL(15,4) DEFAULT 0;

-- source (live/simulated)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live';

-- pnl_percentage
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pnl_percentage DECIMAL(10,4);

-- payout_percent (binary options)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS payout_percent DECIMAL(10,4);

-- duration_seconds (binary options)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- updated_at
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Index for admin trades (market_type + status)
CREATE INDEX IF NOT EXISTS idx_trades_market_status
  ON public.trades(market_type, status);

-- Index for admin search by pair
CREATE INDEX IF NOT EXISTS idx_trades_pair
  ON public.trades(pair);


-- =============================================
-- 3. BACKFILL: sync alias columns from primary columns (one-time)
-- =============================================

-- Fill symbol from pair where symbol is NULL
UPDATE public.trades SET symbol = pair WHERE symbol IS NULL AND pair IS NOT NULL;

-- Fill direction from type where direction is NULL
UPDATE public.trades SET direction = type WHERE direction IS NULL AND type IS NOT NULL;

-- Fill profit_loss from pnl where profit_loss is NULL
UPDATE public.trades SET profit_loss = pnl WHERE profit_loss IS NULL AND pnl IS NOT NULL;


-- =============================================
-- 4. NOTIFICATIONS TABLE: ensure exists (idempotent)
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users read own notifications'
  ) THEN
    CREATE POLICY "Users read own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users update own notifications'
  ) THEN
    CREATE POLICY "Users update own notifications"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Service role inserts notifications'
  ) THEN
    CREATE POLICY "Service role inserts notifications"
      ON public.notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END
$$;
