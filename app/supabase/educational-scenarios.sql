-- ============================================================================
-- NOVA TRADE - EDUCATIONAL SCENARIOS TABLE
-- ============================================================================
-- Run this after the main COMPLETE-FINAL-SETUP.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- EDUCATIONAL SCENARIOS TABLE
-- For admin-configured chart simulation presets
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.educational_scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scenario Info
    name TEXT NOT NULL,
    description TEXT,
    
    -- Price Behavior Configuration
    trend_type TEXT NOT NULL CHECK (trend_type IN ('steady_rise', 'steady_fall', 'range_bound', 'breakout', 'fakeout', 'high_volatility', 'custom')),
    trend_strength DECIMAL(3,2) DEFAULT 0.5 CHECK (trend_strength >= 0 AND trend_strength <= 1),
    volatility DECIMAL(3,2) DEFAULT 0.3 CHECK (volatility >= 0 AND volatility <= 1),
    pullback_frequency DECIMAL(3,2) DEFAULT 0.2 CHECK (pullback_frequency >= 0 AND pullback_frequency <= 1),
    spike_chance DECIMAL(3,2) DEFAULT 0.05 CHECK (spike_chance >= 0 AND spike_chance <= 1),
    
    -- Duration and Pricing
    duration_minutes INT DEFAULT 30,
    base_price DECIMAL(20,8) DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Admin
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_edu_scenarios_active ON public.educational_scenarios(is_active);
CREATE INDEX idx_edu_scenarios_type ON public.educational_scenarios(trend_type);

-- Enable RLS
ALTER TABLE public.educational_scenarios ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Public can view active scenarios
CREATE POLICY "edu_scenarios_select_active" ON public.educational_scenarios
    FOR SELECT USING (is_active = true);

-- Note: Admin operations use service_role key which bypasses RLS

-- Trigger for updated_at
CREATE TRIGGER educational_scenarios_updated_at
    BEFORE UPDATE ON public.educational_scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ADD SOURCE COLUMN TO TRADES TABLE
-- To distinguish live vs educational trades
-- ─────────────────────────────────────────────────────────────────────────────

-- Add source column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trades' AND column_name = 'source') THEN
        ALTER TABLE public.trades ADD COLUMN source TEXT DEFAULT 'live' 
            CHECK (source IN ('live', 'edu'));
    END IF;
END $$;

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_trades_source ON public.trades(source);

-- ─────────────────────────────────────────────────────────────────────────────
-- ADD IS_FROZEN COLUMN TO USERS TABLE
-- For account freezing functionality
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'is_frozen') THEN
        ALTER TABLE public.users ADD COLUMN is_frozen BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT DEFAULT EDUCATIONAL SCENARIOS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.educational_scenarios (name, description, trend_type, trend_strength, volatility, pullback_frequency, spike_chance, duration_minutes, base_price, is_active) VALUES
('Bullish Trend Training', 'Practice identifying and riding uptrends', 'steady_rise', 0.7, 0.3, 0.2, 0.05, 30, 100, true),
('Bearish Trend Training', 'Practice short selling in downtrends', 'steady_fall', 0.6, 0.35, 0.15, 0.05, 30, 100, true),
('Support/Resistance Trading', 'Practice range trading strategies', 'range_bound', 0.2, 0.4, 0.5, 0.02, 45, 100, true),
('Breakout Momentum', 'Catch strong moves after consolidation', 'breakout', 0.9, 0.5, 0.1, 0.15, 20, 100, true),
('Trap Avoidance', 'Learn to avoid false breakouts', 'fakeout', 0.5, 0.6, 0.3, 0.2, 25, 100, true),
('Extreme Conditions', 'High volatility risk management', 'high_volatility', 0.4, 0.9, 0.4, 0.3, 15, 100, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check tables were created
SELECT 'educational_scenarios' as table_name, count(*) as row_count FROM public.educational_scenarios
UNION ALL
SELECT 'admin_logs', count(*) FROM public.admin_logs
UNION ALL
SELECT 'trades', count(*) FROM public.trades
UNION ALL
SELECT 'users', count(*) FROM public.users;
