-- ============================================================================
-- PORTFOLIO STATE PERSISTENCE
-- Run this in Supabase SQL Editor to enable cross-device portfolio sync
-- ============================================================================

-- Store serialized trading state per user (crypto positions, stock positions, etc.)
CREATE TABLE IF NOT EXISTS public.user_trading_data (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    spot_crypto_state JSONB DEFAULT '{}',
    spot_stocks_state JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.user_trading_data ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own trading data
CREATE POLICY "Users can view own trading data"
    ON public.user_trading_data FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading data"
    ON public.user_trading_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading data"
    ON public.user_trading_data FOR UPDATE
    USING (auth.uid() = user_id);

-- Admin full access
CREATE POLICY "Admins full access trading data"
    ON public.user_trading_data FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Index
CREATE INDEX IF NOT EXISTS idx_user_trading_data_updated ON public.user_trading_data(updated_at);
