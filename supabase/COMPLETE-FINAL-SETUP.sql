-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║                                                                            ║
-- ║              NOVA TRADE PLATFORM - COMPLETE DATABASE SETUP                 ║
-- ║                                                                            ║
-- ║  This is the FINAL, COMPLETE SQL setup. Run this entire script in         ║
-- ║  Supabase SQL Editor. It includes:                                         ║
-- ║    • All tables (users, deposits, withdrawals, trades, etc.)               ║
-- ║    • Admin market control tables                                           ║
-- ║    • Proper RLS policies (NO infinite recursion)                           ║
-- ║    • All functions and triggers                                            ║
-- ║    • Default data (payment methods, patterns, settings)                    ║
-- ║                                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- ============================================================================
-- SECTION 1: CLEANUP - DROP EVERYTHING FOR FRESH START
-- ============================================================================
-- Drop all existing policies first (to avoid dependency errors)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
DROP TRIGGER IF EXISTS payment_methods_updated_at ON public.payment_methods;
DROP TRIGGER IF EXISTS deposits_updated_at ON public.deposits;
DROP TRIGGER IF EXISTS trades_updated_at ON public.trades;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_user_balance(UUID, DECIMAL, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS confirm_deposit(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS apply_price_override(TEXT, DECIMAL, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS force_trade_outcome(UUID, TEXT, DECIMAL, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS start_trading_session(UUID) CASCADE;
DROP FUNCTION IF EXISTS end_trading_session(UUID, DECIMAL) CASCADE;

-- Drop all tables (order matters due to foreign keys)
DROP TABLE IF EXISTS public.admin_logs CASCADE;
DROP TABLE IF EXISTS public.trade_outcomes CASCADE;
DROP TABLE IF EXISTS public.market_patterns CASCADE;
DROP TABLE IF EXISTS public.custom_candles CASCADE;
DROP TABLE IF EXISTS public.trading_sessions CASCADE;
DROP TABLE IF EXISTS public.price_overrides CASCADE;
DROP TABLE IF EXISTS public.custom_pairs CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.withdrawals CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.platform_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- SECTION 2: EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 3: CORE TABLES
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.1 USERS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.users (
    -- Primary key links to Supabase Auth
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic Info
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    
    -- Account Settings
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'starter', 'pro', 'elite', 'vip')),
    is_active BOOLEAN DEFAULT true,
    
    -- Balances
    balance_available DECIMAL(15,2) DEFAULT 0,
    balance_bonus DECIMAL(15,2) DEFAULT 0,
    total_deposited DECIMAL(15,2) DEFAULT 0,
    total_withdrawn DECIMAL(15,2) DEFAULT 0,
    total_traded DECIMAL(15,2) DEFAULT 0,
    
    -- Verification Status
    kyc_status TEXT DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected')),
    registration_status TEXT DEFAULT 'pending_kyc' CHECK (registration_status IN ('pending_verification', 'pending_kyc', 'pending_wallet', 'complete')),
    
    -- Wallet
    wallet_address TEXT,
    wallet_type TEXT, -- 'metamask', 'walletconnect', etc.
    
    -- Referral System
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES public.users(id),
    referral_earnings DECIMAL(15,2) DEFAULT 0,
    
    -- Trading Stats
    total_trades INT DEFAULT 0,
    winning_trades INT DEFAULT 0,
    losing_trades INT DEFAULT 0,
    
    -- Timestamps
    last_login_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    kyc_submitted_at TIMESTAMPTZ,
    kyc_verified_at TIMESTAMPTZ,
    kyc_data JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_registration_status ON public.users(registration_status);
CREATE INDEX idx_users_kyc_status ON public.users(kyc_status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.2 PAYMENT METHODS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Type and Name
    type TEXT NOT NULL CHECK (type IN ('crypto', 'bank', 'processor')),
    name TEXT NOT NULL,
    
    -- Crypto-specific fields
    symbol TEXT,              -- BTC, ETH, USDT
    network TEXT,             -- Bitcoin, ERC-20, TRC-20, BEP-20
    address TEXT,             -- Wallet address
    confirmations INT DEFAULT 6,
    
    -- Bank-specific fields
    bank_name TEXT,
    account_name TEXT,
    account_number TEXT,
    routing_number TEXT,
    swift_code TEXT,
    iban TEXT,
    
    -- Common fields
    country TEXT,
    currency TEXT DEFAULT 'USD',
    icon TEXT,
    fee TEXT DEFAULT '0%',
    instructions TEXT,
    min_deposit DECIMAL(15,2) DEFAULT 20,
    max_deposit DECIMAL(15,2),
    processing_time TEXT DEFAULT '1-24 hours',
    
    -- Display
    enabled BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_type ON public.payment_methods(type);
CREATE INDEX idx_payment_methods_enabled ON public.payment_methods(enabled);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.3 DEPOSITS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Order Info
    order_id TEXT NOT NULL UNIQUE,
    amount DECIMAL(15,2) NOT NULL,
    
    -- Payment Method
    method TEXT NOT NULL CHECK (method IN ('crypto', 'bank', 'processor')),
    method_id UUID REFERENCES public.payment_methods(id),
    method_name TEXT NOT NULL,
    
    -- User-submitted Info
    transaction_ref TEXT,     -- TX hash or transfer reference
    sender_address TEXT,      -- For crypto
    sender_name TEXT,         -- For bank transfers
    proof_url TEXT,           -- Screenshot/receipt URL
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'rejected', 'expired')),
    
    -- Admin Processing
    processed_by UUID REFERENCES public.users(id),
    processed_at TIMESTAMPTZ,
    admin_note TEXT,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX idx_deposits_status ON public.deposits(status);
CREATE INDEX idx_deposits_order_id ON public.deposits(order_id);
CREATE INDEX idx_deposits_created_at ON public.deposits(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.4 WITHDRAWALS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Amount
    amount DECIMAL(15,2) NOT NULL,
    fee DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL,
    
    -- Payment Details
    method TEXT NOT NULL CHECK (method IN ('crypto', 'bank', 'processor')),
    
    -- Crypto withdrawal
    wallet_address TEXT,
    wallet_network TEXT,
    
    -- Bank withdrawal
    bank_name TEXT,
    account_name TEXT,
    account_number TEXT,
    swift_code TEXT,
    iban TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
    
    -- Processing
    tx_hash TEXT,             -- For completed crypto withdrawals
    processed_by UUID REFERENCES public.users(id),
    processed_at TIMESTAMPTZ,
    admin_note TEXT,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.5 TRADES TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Trade Details
    pair TEXT NOT NULL,                   -- EUR/USD, BTC/USD, AAPL
    market_type TEXT DEFAULT 'forex' CHECK (market_type IN ('forex', 'crypto', 'stocks', 'commodities', 'indices')),
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    side TEXT DEFAULT 'long' CHECK (side IN ('long', 'short')),
    
    -- Size and Pricing
    amount DECIMAL(15,2) NOT NULL,        -- Position size in USD
    quantity DECIMAL(20,8),               -- Actual quantity of asset
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    exit_price DECIMAL(20,8),
    
    -- Leverage and Margin
    leverage INT DEFAULT 1 CHECK (leverage >= 1 AND leverage <= 1000),
    margin_used DECIMAL(15,2),
    
    -- Risk Management
    stop_loss DECIMAL(20,8),
    take_profit DECIMAL(20,8),
    trailing_stop DECIMAL(10,4),
    
    -- P&L
    pnl DECIMAL(15,2) DEFAULT 0,
    pnl_percentage DECIMAL(10,4) DEFAULT 0,
    fees DECIMAL(15,2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'open' CHECK (status IN ('pending', 'open', 'closed', 'liquidated', 'cancelled')),
    close_reason TEXT,                    -- 'manual', 'stop_loss', 'take_profit', 'liquidation', 'admin'
    
    -- Timestamps
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_pair ON public.trades(pair);
CREATE INDEX idx_trades_market_type ON public.trades(market_type);
CREATE INDEX idx_trades_created_at ON public.trades(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.6 INVESTMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Plan Details
    plan_id TEXT NOT NULL,                -- starter, growth, premium, elite
    plan_name TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    
    -- ROI Settings
    roi_percentage DECIMAL(5,2) NOT NULL,
    roi_type TEXT DEFAULT 'fixed' CHECK (roi_type IN ('fixed', 'variable')),
    expected_return DECIMAL(15,2) NOT NULL,
    
    -- Duration
    duration_days INT NOT NULL,
    payout_frequency TEXT DEFAULT 'end' CHECK (payout_frequency IN ('daily', 'weekly', 'monthly', 'end')),
    
    -- Earnings
    total_earned DECIMAL(15,2) DEFAULT 0,
    last_payout_amount DECIMAL(15,2),
    last_payout_at TIMESTAMPTZ,
    next_payout_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    
    -- Timestamps
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investments_user_id ON public.investments(user_id);
CREATE INDEX idx_investments_status ON public.investments(status);
CREATE INDEX idx_investments_ends_at ON public.investments(ends_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.7 TRANSACTIONS TABLE (Audit Log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Transaction Type
    type TEXT NOT NULL CHECK (type IN (
        'deposit', 'withdrawal', 
        'trade_open', 'trade_close', 'trade_pnl',
        'investment', 'investment_payout',
        'bonus', 'referral_bonus',
        'fee', 'admin_credit', 'admin_debit'
    )),
    
    -- Amounts
    amount DECIMAL(15,2) NOT NULL,
    fee DECIMAL(15,2) DEFAULT 0,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    
    -- Reference
    reference_type TEXT,      -- 'deposit', 'withdrawal', 'trade', 'investment'
    reference_id UUID,
    
    -- Details
    description TEXT,
    metadata JSONB,
    
    -- Processing
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_reference ON public.transactions(reference_type, reference_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3.8 PLATFORM SETTINGS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    updated_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_platform_settings_key ON public.platform_settings(key);
CREATE INDEX idx_platform_settings_category ON public.platform_settings(category);

-- ============================================================================
-- SECTION 4: ADMIN MARKET CONTROL TABLES
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.1 CUSTOM TRADING PAIRS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.custom_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Pair Info
    symbol TEXT UNIQUE NOT NULL,          -- NOVA/USD
    name TEXT NOT NULL,
    category TEXT DEFAULT 'forex' CHECK (category IN ('forex', 'crypto', 'stocks', 'commodities', 'indices')),
    
    -- Pricing
    base_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8) NOT NULL,
    bid_price DECIMAL(20,8),
    ask_price DECIMAL(20,8),
    
    -- Trading Parameters
    spread DECIMAL(10,4) DEFAULT 0.0002,
    pip_value DECIMAL(10,6) DEFAULT 0.0001,
    leverage_max INT DEFAULT 100,
    min_lot DECIMAL(10,4) DEFAULT 0.01,
    max_lot DECIMAL(10,4) DEFAULT 100,
    
    -- Settings
    trading_hours TEXT DEFAULT '24/7',
    is_enabled BOOLEAN DEFAULT true,
    
    -- Display
    description TEXT,
    icon TEXT,
    
    -- Admin
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_pairs_symbol ON public.custom_pairs(symbol);
CREATE INDEX idx_custom_pairs_category ON public.custom_pairs(category);
CREATE INDEX idx_custom_pairs_enabled ON public.custom_pairs(is_enabled);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.2 PRICE OVERRIDES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.price_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target
    pair_symbol TEXT NOT NULL,
    
    -- Override Settings
    override_price DECIMAL(20,8),
    price_direction TEXT CHECK (price_direction IN ('up', 'down', 'neutral', 'volatile')),
    volatility_multiplier DECIMAL(5,2) DEFAULT 1.0,
    price_change_per_minute DECIMAL(10,6),
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    priority INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    
    -- Admin
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_overrides_pair ON public.price_overrides(pair_symbol);
CREATE INDEX idx_price_overrides_active ON public.price_overrides(is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.3 TRADING SESSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.trading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session Info
    name TEXT NOT NULL,
    description TEXT,
    pair_symbol TEXT NOT NULL,
    session_type TEXT DEFAULT 'standard' CHECK (session_type IN ('standard', 'high_volatility', 'pump', 'dump', 'sideways')),
    
    -- Timing
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    
    -- Price Control
    start_price DECIMAL(20,8) NOT NULL,
    target_price DECIMAL(20,8),
    price_path TEXT DEFAULT 'organic' CHECK (price_path IN ('organic', 'linear', 'volatile', 'spike', 'pattern')),
    pattern_id UUID,          -- Reference to market_patterns
    
    -- Outcome Control
    win_rate_override DECIMAL(5,2),       -- Force win rate (0.30 = 30%)
    max_profit_per_user DECIMAL(15,2),
    max_loss_per_user DECIMAL(15,2),
    
    -- Stats
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    actual_end_price DECIMAL(20,8),
    participants_count INT DEFAULT 0,
    total_volume DECIMAL(20,2) DEFAULT 0,
    total_pnl DECIMAL(15,2) DEFAULT 0,
    
    -- Admin
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trading_sessions_status ON public.trading_sessions(status);
CREATE INDEX idx_trading_sessions_pair ON public.trading_sessions(pair_symbol);
CREATE INDEX idx_trading_sessions_starts_at ON public.trading_sessions(starts_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.4 CUSTOM CANDLES (Chart Data)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.custom_candles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_symbol TEXT NOT NULL,
    timeframe TEXT DEFAULT '1m' CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')),
    
    -- OHLCV Data
    timestamp TIMESTAMPTZ NOT NULL,
    open_price DECIMAL(20,8) NOT NULL,
    high_price DECIMAL(20,8) NOT NULL,
    low_price DECIMAL(20,8) NOT NULL,
    close_price DECIMAL(20,8) NOT NULL,
    volume DECIMAL(20,2) DEFAULT 0,
    
    -- Metadata
    is_generated BOOLEAN DEFAULT true,    -- true = admin/system, false = market
    session_id UUID REFERENCES public.trading_sessions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_custom_candles_pair_time ON public.custom_candles(pair_symbol, timeframe, timestamp DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.5 TRADE OUTCOMES (Admin-controlled)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.trade_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Target
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE,
    
    -- Outcome Settings
    forced_outcome TEXT CHECK (forced_outcome IN ('win', 'lose', 'breakeven')),
    target_pnl DECIMAL(15,2),
    target_pnl_percentage DECIMAL(10,4),
    close_price_override DECIMAL(20,8),
    
    -- Timing
    close_at TIMESTAMPTZ,
    close_delay_seconds INT,
    
    -- Status
    is_applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMPTZ,
    
    -- Admin
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    note TEXT
);

CREATE INDEX idx_trade_outcomes_user ON public.trade_outcomes(user_id);
CREATE INDEX idx_trade_outcomes_trade ON public.trade_outcomes(trade_id);
CREATE INDEX idx_trade_outcomes_applied ON public.trade_outcomes(is_applied);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.6 MARKET PATTERNS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.market_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Pattern Info
    name TEXT NOT NULL,
    description TEXT,
    pattern_type TEXT CHECK (pattern_type IN ('bullish', 'bearish', 'consolidation', 'breakout', 'reversal', 'custom')),
    
    -- Pattern Data
    price_points JSONB NOT NULL,          -- [{t: 0, p: 0}, {t: 20, p: 0.5}, ...]
    duration_minutes INT DEFAULT 60,
    volatility DECIMAL(5,2) DEFAULT 1.0,
    
    -- Settings
    is_public BOOLEAN DEFAULT true,
    
    -- Admin
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_patterns_type ON public.market_patterns(pattern_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4.7 ADMIN LOGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.users(id),
    
    -- Action Details
    action TEXT NOT NULL,                 -- 'price_override', 'balance_adjust', etc.
    target_type TEXT,                     -- 'user', 'trade', 'pair', 'session'
    target_id UUID,
    
    -- Data
    details JSONB,
    previous_value JSONB,
    new_value JSONB,
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON public.admin_logs(action);
CREATE INDEX idx_admin_logs_target ON public.admin_logs(target_type, target_id);
CREATE INDEX idx_admin_logs_created_at ON public.admin_logs(created_at DESC);

-- ============================================================================
-- SECTION 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: RLS POLICIES (Non-Recursive - FIXED!)
-- ============================================================================
-- IMPORTANT: We use simple auth.uid() = id checks
-- Admin operations use service_role key which bypasses RLS

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.1 USERS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.2 PAYMENT METHODS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "payment_methods_select_enabled" ON public.payment_methods
    FOR SELECT USING (enabled = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.3 DEPOSITS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "deposits_select_own" ON public.deposits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "deposits_insert_own" ON public.deposits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deposits_update_own_pending" ON public.deposits
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.4 WITHDRAWALS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "withdrawals_select_own" ON public.withdrawals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "withdrawals_insert_own" ON public.withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "withdrawals_update_own_pending" ON public.withdrawals
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.5 TRADES POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "trades_select_own" ON public.trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "trades_insert_own" ON public.trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trades_update_own" ON public.trades
    FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.6 INVESTMENTS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "investments_select_own" ON public.investments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "investments_insert_own" ON public.investments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.7 TRANSACTIONS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "transactions_select_own" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.8 PLATFORM SETTINGS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "settings_select_public" ON public.platform_settings
    FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.9 CUSTOM PAIRS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "custom_pairs_select_enabled" ON public.custom_pairs
    FOR SELECT USING (is_enabled = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.10 TRADING SESSIONS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "trading_sessions_select_public" ON public.trading_sessions
    FOR SELECT USING (status IN ('scheduled', 'active', 'completed'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.11 CUSTOM CANDLES POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "custom_candles_select_all" ON public.custom_candles
    FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6.12 MARKET PATTERNS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "market_patterns_select_public" ON public.market_patterns
    FOR SELECT USING (is_public = true);

-- Note: price_overrides, trade_outcomes, admin_logs have NO user policies
-- They are admin-only and accessed via service_role key

-- ============================================================================
-- SECTION 7: FUNCTIONS
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.1 Auto-update timestamp function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.2 Generate Order ID function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_order_id(prefix TEXT DEFAULT 'ORD')
RETURNS TEXT AS $$
BEGIN
    RETURN prefix || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.3 Generate Referral Code function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = code) INTO exists;
        EXIT WHEN NOT exists;
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.4 Update User Balance function (Admin use via service_role)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_balance(
    p_user_id UUID,
    p_amount DECIMAL,
    p_type TEXT,              -- 'credit' or 'debit'
    p_description TEXT DEFAULT NULL,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
BEGIN
    -- Get current balance with lock
    SELECT balance_available INTO v_current_balance
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate new balance
    IF p_type = 'credit' THEN
        v_new_balance := v_current_balance + p_amount;
    ELSIF p_type = 'debit' THEN
        v_new_balance := v_current_balance - p_amount;
        IF v_new_balance < 0 THEN
            RETURN FALSE;
        END IF;
    ELSE
        RETURN FALSE;
    END IF;
    
    -- Update balance
    UPDATE public.users
    SET balance_available = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    -- Log transaction
    INSERT INTO public.transactions (
        user_id, type, amount, balance_before, balance_after, 
        description, reference_type, reference_id
    ) VALUES (
        p_user_id,
        CASE WHEN p_type = 'credit' THEN 'admin_credit' ELSE 'admin_debit' END,
        p_amount,
        v_current_balance,
        v_new_balance,
        p_description,
        p_reference_type,
        p_reference_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.5 Confirm Deposit function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION confirm_deposit(
    p_deposit_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_deposit RECORD;
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
BEGIN
    -- Get deposit with lock
    SELECT * INTO v_deposit
    FROM public.deposits
    WHERE id = p_deposit_id AND status = 'pending'
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update deposit status
    UPDATE public.deposits
    SET status = 'confirmed',
        processed_by = p_admin_id,
        processed_at = NOW(),
        admin_note = p_note,
        updated_at = NOW()
    WHERE id = p_deposit_id;
    
    -- Get current user balance
    SELECT balance_available INTO v_current_balance
    FROM public.users
    WHERE id = v_deposit.user_id
    FOR UPDATE;
    
    v_new_balance := v_current_balance + v_deposit.amount;
    
    -- Credit user balance
    UPDATE public.users
    SET balance_available = v_new_balance,
        total_deposited = total_deposited + v_deposit.amount,
        updated_at = NOW()
    WHERE id = v_deposit.user_id;
    
    -- Log transaction
    INSERT INTO public.transactions (
        user_id, type, amount, balance_before, balance_after,
        description, reference_type, reference_id
    ) VALUES (
        v_deposit.user_id,
        'deposit',
        v_deposit.amount,
        v_current_balance,
        v_new_balance,
        'Deposit confirmed: ' || v_deposit.method_name,
        'deposit',
        p_deposit_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.6 Reject Deposit function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reject_deposit(
    p_deposit_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.deposits
    SET status = 'rejected',
        processed_by = p_admin_id,
        processed_at = NOW(),
        rejection_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_deposit_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.7 Apply Price Override function
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7.8 Force Trade Outcome function
-- ─────────────────────────────────────────────────────────────────────────────
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
    SELECT * INTO v_trade FROM public.trades WHERE id = p_trade_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    
    INSERT INTO public.trade_outcomes (trade_id, user_id, forced_outcome, target_pnl, created_by, note)
    VALUES (p_trade_id, v_trade.user_id, p_outcome, p_target_pnl, p_admin_id, p_note);
    
    INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
    VALUES (p_admin_id, 'trade_outcome', 'trade', p_trade_id, jsonb_build_object(
        'outcome', p_outcome,
        'target_pnl', p_target_pnl,
        'user_id', v_trade.user_id
    ));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 8: TRIGGERS
-- ============================================================================
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_methods_updated_at
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER deposits_updated_at
    BEFORE UPDATE ON public.deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER withdrawals_updated_at
    BEFORE UPDATE ON public.withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trades_updated_at
    BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER investments_updated_at
    BEFORE UPDATE ON public.investments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER custom_pairs_updated_at
    BEFORE UPDATE ON public.custom_pairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER price_overrides_updated_at
    BEFORE UPDATE ON public.price_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trading_sessions_updated_at
    BEFORE UPDATE ON public.trading_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- SECTION 9: DEFAULT DATA
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 9.1 Default Payment Methods
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.payment_methods (type, name, symbol, network, address, icon, min_deposit, confirmations, enabled, display_order, instructions) VALUES
    ('crypto', 'Bitcoin (BTC)', 'BTC', 'Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', '₿', 50, 3, true, 1, 'Send BTC to the address above. Your deposit will be credited after 3 confirmations.'),
    ('crypto', 'Ethereum (ETH)', 'ETH', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', 'Ξ', 50, 12, true, 2, 'Send ETH to the address above. Your deposit will be credited after 12 confirmations.'),
    ('crypto', 'USDT (TRC-20)', 'USDT', 'TRC-20', 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9', '₮', 20, 20, true, 3, 'Send USDT on the TRON network to the address above.'),
    ('crypto', 'USDT (ERC-20)', 'USDT', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', '₮', 50, 12, true, 4, 'Send USDT on the Ethereum network to the address above.'),
    ('crypto', 'USDC', 'USDC', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', '$', 50, 12, true, 5, 'Send USDC on the Ethereum network to the address above.'),
    ('crypto', 'BNB', 'BNB', 'BEP-20', '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', 'B', 30, 15, true, 6, 'Send BNB on the Binance Smart Chain to the address above.'),
    ('bank', 'Bank Transfer (USD)', NULL, NULL, NULL, '🏦', 100, NULL, true, 7, 'Contact support for bank transfer details.'),
    ('bank', 'Bank Transfer (EUR)', NULL, NULL, NULL, '🏦', 100, NULL, true, 8, 'Contact support for SEPA transfer details.'),
    ('processor', 'PayPal', NULL, NULL, NULL, 'P', 50, NULL, false, 9, 'PayPal payments coming soon.');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9.2 Default Platform Settings
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.platform_settings (key, value, description, category) VALUES
    ('site_name', '"NOVA TRADE"', 'Platform name', 'general'),
    ('support_email', '"support@novatrade.com"', 'Support email address', 'contact'),
    ('support_whatsapp', '"+1234567890"', 'Support WhatsApp number', 'contact'),
    ('deposit_instructions', '"After making your deposit, submit the transaction details below. Our team will verify and credit your account within 1-24 hours."', 'Deposit page instructions', 'deposits'),
    ('require_proof', 'true', 'Require payment proof screenshot for deposits', 'deposits'),
    ('min_deposit', '20', 'Minimum deposit amount (USD)', 'deposits'),
    ('max_deposit', '100000', 'Maximum deposit amount (USD)', 'deposits'),
    ('min_withdrawal', '50', 'Minimum withdrawal amount (USD)', 'withdrawals'),
    ('max_withdrawal', '50000', 'Maximum withdrawal amount (USD)', 'withdrawals'),
    ('withdrawal_fee_percent', '0', 'Withdrawal fee percentage', 'withdrawals'),
    ('withdrawal_fee_fixed', '0', 'Fixed withdrawal fee (USD)', 'withdrawals'),
    ('kyc_required', 'true', 'KYC required for withdrawals', 'verification'),
    ('kyc_required_amount', '1000', 'KYC required for withdrawals over this amount', 'verification'),
    ('referral_bonus_percent', '5', 'Referral bonus percentage of referee first deposit', 'referral'),
    ('welcome_bonus', '0', 'Welcome bonus for new users (USD)', 'bonuses'),
    ('maintenance_mode', 'false', 'Platform maintenance mode', 'system'),
    ('trading_enabled', 'true', 'Trading enabled globally', 'trading'),
    ('max_leverage', '100', 'Maximum leverage allowed', 'trading'),
    ('default_leverage', '10', 'Default leverage for new trades', 'trading');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9.3 Default Market Patterns
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.market_patterns (name, description, pattern_type, price_points, duration_minutes, volatility) VALUES
    ('Steady Rise', 'Gradual upward movement with small pullbacks', 'bullish', 
     '[{"t":0,"p":0},{"t":10,"p":0.15},{"t":20,"p":0.25},{"t":30,"p":0.40},{"t":40,"p":0.35},{"t":50,"p":0.55},{"t":60,"p":0.65},{"t":70,"p":0.75},{"t":80,"p":0.85},{"t":90,"p":0.90},{"t":100,"p":1.0}]', 
     60, 0.8),
    ('Steady Fall', 'Gradual downward movement with small bounces', 'bearish',
     '[{"t":0,"p":0},{"t":10,"p":-0.10},{"t":20,"p":-0.25},{"t":30,"p":-0.20},{"t":40,"p":-0.40},{"t":50,"p":-0.55},{"t":60,"p":-0.60},{"t":70,"p":-0.75},{"t":80,"p":-0.85},{"t":90,"p":-0.90},{"t":100,"p":-1.0}]', 
     60, 0.8),
    ('Pump and Dump', 'Sharp rise followed by dramatic crash', 'reversal',
     '[{"t":0,"p":0},{"t":15,"p":0.80},{"t":25,"p":1.20},{"t":35,"p":1.80},{"t":45,"p":1.50},{"t":55,"p":0.80},{"t":65,"p":0.20},{"t":75,"p":-0.30},{"t":85,"p":-0.50},{"t":100,"p":-0.70}]', 
     60, 1.5),
    ('Dump and Pump', 'Sharp fall followed by dramatic recovery', 'reversal',
     '[{"t":0,"p":0},{"t":15,"p":-0.80},{"t":25,"p":-1.20},{"t":35,"p":-1.50},{"t":45,"p":-1.20},{"t":55,"p":-0.60},{"t":65,"p":0},{"t":75,"p":0.40},{"t":85,"p":0.70},{"t":100,"p":1.0}]', 
     60, 1.5),
    ('Sideways Chop', 'Range-bound choppy movement', 'consolidation',
     '[{"t":0,"p":0},{"t":10,"p":0.15},{"t":20,"p":-0.10},{"t":30,"p":0.20},{"t":40,"p":-0.05},{"t":50,"p":0.10},{"t":60,"p":-0.15},{"t":70,"p":0.08},{"t":80,"p":-0.05},{"t":90,"p":0.12},{"t":100,"p":0.05}]', 
     60, 0.5),
    ('V Recovery', 'Sharp drop then V-shaped recovery', 'reversal',
     '[{"t":0,"p":0},{"t":20,"p":-0.50},{"t":35,"p":-1.00},{"t":50,"p":-1.20},{"t":65,"p":-0.80},{"t":80,"p":-0.30},{"t":90,"p":0.20},{"t":100,"p":0.80}]', 
     60, 1.2),
    ('Inverted V', 'Sharp rise then inverted V-shaped drop', 'reversal',
     '[{"t":0,"p":0},{"t":20,"p":0.50},{"t":35,"p":1.00},{"t":50,"p":1.20},{"t":65,"p":0.80},{"t":80,"p":0.30},{"t":90,"p":-0.20},{"t":100,"p":-0.60}]', 
     60, 1.2),
    ('Bull Flag', 'Rise, consolidation, then continuation up', 'bullish',
     '[{"t":0,"p":0},{"t":20,"p":0.60},{"t":30,"p":0.55},{"t":40,"p":0.50},{"t":50,"p":0.52},{"t":60,"p":0.48},{"t":70,"p":0.55},{"t":80,"p":0.75},{"t":90,"p":0.90},{"t":100,"p":1.10}]', 
     60, 0.9),
    ('Bear Flag', 'Fall, consolidation, then continuation down', 'bearish',
     '[{"t":0,"p":0},{"t":20,"p":-0.60},{"t":30,"p":-0.55},{"t":40,"p":-0.50},{"t":50,"p":-0.52},{"t":60,"p":-0.48},{"t":70,"p":-0.55},{"t":80,"p":-0.75},{"t":90,"p":-0.90},{"t":100,"p":-1.10}]', 
     60, 0.9),
    ('Flash Spike', 'Sudden spike then quick return', 'custom',
     '[{"t":0,"p":0},{"t":10,"p":0.10},{"t":20,"p":0.05},{"t":40,"p":0.08},{"t":45,"p":1.50},{"t":50,"p":1.20},{"t":55,"p":0.30},{"t":60,"p":0.15},{"t":80,"p":0.10},{"t":100,"p":0.05}]', 
     30, 2.0);

-- ============================================================================
-- SECTION 10: GRANT PERMISSIONS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- SECTION 11: VERIFICATION (Run these to check setup)
-- ============================================================================
-- Uncomment and run these queries to verify:

-- Check all tables:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check RLS policies:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;

-- Check payment methods:
-- SELECT name, type, symbol, enabled FROM public.payment_methods ORDER BY display_order;

-- Check platform settings:
-- SELECT key, value FROM public.platform_settings ORDER BY key;

-- Check market patterns:
-- SELECT name, pattern_type FROM public.market_patterns;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║                                                                            ║
-- ║                         SETUP COMPLETE! ✅                                 ║
-- ║                                                                            ║
-- ║  IMPORTANT: After running this SQL, go to Supabase Dashboard:              ║
-- ║                                                                            ║
-- ║  1. Authentication → Providers → Email                                     ║
-- ║  2. Turn OFF "Confirm email"                                               ║
-- ║  3. Click Save                                                             ║
-- ║                                                                            ║
-- ║  Registration Status Values:                                               ║
-- ║    • pending_verification = Email not verified                             ║
-- ║    • pending_kyc = Needs KYC verification                                  ║
-- ║    • pending_wallet = Needs wallet connection                              ║
-- ║    • complete = Fully registered                                           ║
-- ║                                                                            ║
-- ╚════════════════════════════════════════════════════════════════════════════╝
