-- ============================================
-- ADMIN MARKET CONTROL - SUPABASE SCHEMA
-- ============================================
-- Run this AFTER the main schema.sql
-- This adds tables for admin-controlled trading

-- ============================================
-- CUSTOM TRADING PAIRS (Admin Created)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT UNIQUE NOT NULL, -- e.g., 'NOVA/USD'
    name TEXT NOT NULL,
    category TEXT DEFAULT 'forex' CHECK (category IN ('forex', 'crypto', 'stocks', 'commodities')),
    base_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8) NOT NULL,
    spread DECIMAL(10,4) DEFAULT 0.0002,
    pip_value DECIMAL(10,6) DEFAULT 0.0001,
    leverage_max INT DEFAULT 100,
    min_lot DECIMAL(10,4) DEFAULT 0.01,
    max_lot DECIMAL(10,4) DEFAULT 100,
    trading_hours TEXT DEFAULT '24/7', -- or 'market_hours'
    is_enabled BOOLEAN DEFAULT true,
    description TEXT,
    icon TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRICE OVERRIDES (Manual Price Control)
-- ============================================
CREATE TABLE IF NOT EXISTS public.price_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_symbol TEXT NOT NULL, -- Can be custom or real pair
    override_price DECIMAL(20,8),
    price_direction TEXT CHECK (price_direction IN ('up', 'down', 'neutral', 'volatile')),
    volatility_multiplier DECIMAL(5,2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ, -- Optional expiry
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_overrides_pair ON public.price_overrides(pair_symbol);

-- ============================================
-- TRADING SESSIONS (Scheduled Events)
-- ============================================
CREATE TABLE IF NOT EXISTS public.trading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    pair_symbol TEXT NOT NULL,
    session_type TEXT DEFAULT 'standard' CHECK (session_type IN ('standard', 'high_volatility', 'pump', 'dump', 'sideways')),
    
    -- Session timing
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    
    -- Price targets
    start_price DECIMAL(20,8) NOT NULL,
    target_price DECIMAL(20,8), -- Where price should end
    price_path TEXT DEFAULT 'organic', -- 'organic', 'linear', 'volatile', 'spike'
    
    -- Outcome control
    win_rate_override DECIMAL(5,2), -- e.g., 0.30 = 30% of trades win
    max_profit_per_user DECIMAL(15,2),
    max_loss_per_user DECIMAL(15,2),
    
    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    actual_end_price DECIMAL(20,8),
    
    -- Metadata
    participants_count INT DEFAULT 0,
    total_volume DECIMAL(20,2) DEFAULT 0,
    
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.trading_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_pair ON public.trading_sessions(pair_symbol);

-- ============================================
-- CANDLE DATA (Admin Controlled Charts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.custom_candles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_symbol TEXT NOT NULL,
    timeframe TEXT DEFAULT '1m' CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d')),
    timestamp TIMESTAMPTZ NOT NULL,
    open_price DECIMAL(20,8) NOT NULL,
    high_price DECIMAL(20,8) NOT NULL,
    low_price DECIMAL(20,8) NOT NULL,
    close_price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,2) DEFAULT 0,
    is_generated BOOLEAN DEFAULT true, -- true = admin generated, false = from market
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candles_pair_time ON public.custom_candles(pair_symbol, timestamp DESC);

-- ============================================
-- USER TRADE OUTCOMES (Admin Controlled)
-- ============================================
-- This table allows admin to pre-determine trade outcomes for specific users
CREATE TABLE IF NOT EXISTS public.trade_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
    
    -- Outcome settings
    forced_outcome TEXT CHECK (forced_outcome IN ('win', 'lose', 'breakeven')),
    target_pnl DECIMAL(15,2), -- Exact P&L to assign
    target_pnl_percentage DECIMAL(10,4),
    
    -- Timing
    close_at TIMESTAMPTZ, -- When to auto-close
    close_price_override DECIMAL(20,8),
    
    -- Status
    is_applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMPTZ,
    
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_trade_outcomes_user ON public.trade_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_outcomes_trade ON public.trade_outcomes(trade_id);

-- ============================================
-- MARKET PATTERNS (Pre-built Price Movements)
-- ============================================
CREATE TABLE IF NOT EXISTS public.market_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    pattern_type TEXT CHECK (pattern_type IN ('bullish', 'bearish', 'consolidation', 'breakout', 'reversal', 'custom')),
    
    -- Pattern data (array of price movements as percentage from start)
    price_points JSONB NOT NULL, -- [{time: 0, price: 0}, {time: 1, price: 0.5}, ...]
    duration_minutes INT DEFAULT 60,
    volatility DECIMAL(5,2) DEFAULT 1.0,
    
    is_public BOOLEAN DEFAULT true, -- Available to use in sessions
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default patterns
INSERT INTO public.market_patterns (name, description, pattern_type, price_points, duration_minutes) VALUES
('Steady Rise', 'Gradual upward movement', 'bullish', 
 '[{"t":0,"p":0},{"t":20,"p":0.3},{"t":40,"p":0.5},{"t":60,"p":0.8},{"t":80,"p":0.9},{"t":100,"p":1.0}]', 60),
('Steady Fall', 'Gradual downward movement', 'bearish',
 '[{"t":0,"p":0},{"t":20,"p":-0.2},{"t":40,"p":-0.5},{"t":60,"p":-0.7},{"t":80,"p":-0.9},{"t":100,"p":-1.0}]', 60),
('Pump and Dump', 'Sharp rise followed by crash', 'reversal',
 '[{"t":0,"p":0},{"t":30,"p":1.5},{"t":50,"p":1.8},{"t":60,"p":1.2},{"t":80,"p":0.3},{"t":100,"p":-0.5}]', 60),
('Sideways Chop', 'Range-bound movement', 'consolidation',
 '[{"t":0,"p":0},{"t":20,"p":0.2},{"t":40,"p":-0.1},{"t":60,"p":0.15},{"t":80,"p":-0.05},{"t":100,"p":0.1}]', 60),
('V Recovery', 'Sharp drop then recovery', 'reversal',
 '[{"t":0,"p":0},{"t":30,"p":-1.0},{"t":50,"p":-1.2},{"t":70,"p":-0.5},{"t":90,"p":0.3},{"t":100,"p":0.8}]', 60)
ON CONFLICT DO NOTHING;

-- ============================================
-- ADMIN ACTIVITY LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL, -- 'price_override', 'balance_adjust', 'trade_outcome', etc.
    target_type TEXT, -- 'user', 'trade', 'pair', 'session'
    target_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_logs(action);

-- ============================================
-- FUNCTIONS FOR MARKET CONTROL
-- ============================================

-- Function to apply price override
CREATE OR REPLACE FUNCTION apply_price_override(
    p_pair TEXT,
    p_price DECIMAL,
    p_direction TEXT,
    p_admin_id UUID
) RETURNS UUID AS $$
DECLARE
    v_override_id UUID;
BEGIN
    -- Deactivate existing overrides for this pair
    UPDATE public.price_overrides 
    SET is_active = false, updated_at = NOW()
    WHERE pair_symbol = p_pair AND is_active = true;
    
    -- Create new override
    INSERT INTO public.price_overrides (pair_symbol, override_price, price_direction, is_active, created_by)
    VALUES (p_pair, p_price, p_direction, true, p_admin_id)
    RETURNING id INTO v_override_id;
    
    -- Log action
    INSERT INTO public.admin_logs (admin_id, action, target_type, details)
    VALUES (p_admin_id, 'price_override', 'pair', jsonb_build_object(
        'pair', p_pair,
        'price', p_price,
        'direction', p_direction
    ));
    
    RETURN v_override_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to force trade outcome
CREATE OR REPLACE FUNCTION force_trade_outcome(
    p_trade_id UUID,
    p_outcome TEXT,
    p_target_pnl DECIMAL,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_trade RECORD;
BEGIN
    -- Get trade
    SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    
    -- Create outcome record
    INSERT INTO public.trade_outcomes (trade_id, user_id, forced_outcome, target_pnl, created_by, note)
    VALUES (p_trade_id, v_trade.user_id, p_outcome, p_target_pnl, p_admin_id, p_note);
    
    -- Log action
    INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
    VALUES (p_admin_id, 'trade_outcome', 'trade', p_trade_id, jsonb_build_object(
        'outcome', p_outcome,
        'target_pnl', p_target_pnl,
        'user_id', v_trade.user_id
    ));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start trading session
CREATE OR REPLACE FUNCTION start_trading_session(
    p_session_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.trading_sessions
    SET status = 'active', updated_at = NOW()
    WHERE id = p_session_id AND status = 'scheduled';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end trading session
CREATE OR REPLACE FUNCTION end_trading_session(
    p_session_id UUID,
    p_end_price DECIMAL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.trading_sessions
    SET status = 'completed', 
        actual_end_price = p_end_price,
        updated_at = NOW()
    WHERE id = p_session_id AND status = 'active';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE public.custom_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Users can see enabled custom pairs
CREATE POLICY "Users can view enabled pairs" ON public.custom_pairs
    FOR SELECT USING (is_enabled = true);

-- Admins can manage all market tables
CREATE POLICY "Admins manage custom_pairs" ON public.custom_pairs
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage price_overrides" ON public.price_overrides
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage sessions" ON public.trading_sessions
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view active sessions" ON public.trading_sessions
    FOR SELECT USING (status IN ('scheduled', 'active'));

CREATE POLICY "Admins manage candles" ON public.custom_candles
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view candles" ON public.custom_candles
    FOR SELECT USING (true);

CREATE POLICY "Admins manage outcomes" ON public.trade_outcomes
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins view logs" ON public.admin_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins insert logs" ON public.admin_logs
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users view patterns" ON public.market_patterns
    FOR SELECT USING (is_public = true);

CREATE POLICY "Admins manage patterns" ON public.market_patterns
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON public.custom_pairs TO authenticated;
GRANT ALL ON public.price_overrides TO authenticated;
GRANT ALL ON public.trading_sessions TO authenticated;
GRANT ALL ON public.custom_candles TO authenticated;
GRANT ALL ON public.trade_outcomes TO authenticated;
GRANT ALL ON public.market_patterns TO authenticated;
GRANT ALL ON public.admin_logs TO authenticated;
