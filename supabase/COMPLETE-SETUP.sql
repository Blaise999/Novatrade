-- ============================================
-- NOVA TRADE PLATFORM - COMPLETE DATABASE SETUP
-- ============================================
-- Run this ENTIRE script in Supabase SQL Editor
-- This sets up everything from scratch with all fixes
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: DROP EXISTING TABLES (Clean Start)
-- ============================================
-- Comment these out if you want to keep existing data
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.deposits CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================
-- STEP 2: CREATE USERS TABLE
-- ============================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'starter', 'pro', 'elite', 'vip')),
    balance_available DECIMAL(15,2) DEFAULT 0,
    balance_bonus DECIMAL(15,2) DEFAULT 0,
    total_deposited DECIMAL(15,2) DEFAULT 0,
    kyc_status TEXT DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected')),
    registration_status TEXT DEFAULT 'pending_kyc' CHECK (registration_status IN ('pending_verification', 'pending_kyc', 'pending_wallet', 'complete')),
    wallet_address TEXT,
    is_active BOOLEAN DEFAULT true,
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_referral ON public.users(referral_code);
CREATE INDEX idx_users_registration ON public.users(registration_status);

-- ============================================
-- STEP 3: CREATE PAYMENT METHODS TABLE
-- ============================================
CREATE TABLE public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('crypto', 'bank', 'processor')),
    name TEXT NOT NULL,
    symbol TEXT,
    network TEXT,
    address TEXT,
    account_name TEXT,
    account_number TEXT,
    routing_number TEXT,
    swift_code TEXT,
    iban TEXT,
    country TEXT,
    currency TEXT DEFAULT 'USD',
    icon TEXT,
    fee TEXT DEFAULT '0%',
    instructions TEXT,
    min_deposit DECIMAL(15,2) DEFAULT 20,
    confirmations INT DEFAULT 6,
    enabled BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 4: CREATE DEPOSITS TABLE
-- ============================================
CREATE TABLE public.deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('crypto', 'bank', 'processor')),
    method_id UUID REFERENCES public.payment_methods(id),
    method_name TEXT NOT NULL,
    transaction_ref TEXT,
    proof_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    processed_by UUID REFERENCES public.users(id),
    processed_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for deposits
CREATE INDEX idx_deposits_user ON public.deposits(user_id);
CREATE INDEX idx_deposits_status ON public.deposits(status);
CREATE INDEX idx_deposits_order ON public.deposits(order_id);

-- ============================================
-- STEP 5: CREATE TRADES TABLE
-- ============================================
CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pair TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    amount DECIMAL(15,2) NOT NULL,
    entry_price DECIMAL(15,8) NOT NULL,
    current_price DECIMAL(15,8),
    exit_price DECIMAL(15,8),
    leverage INT DEFAULT 1,
    margin_used DECIMAL(15,2),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated')),
    pnl DECIMAL(15,2) DEFAULT 0,
    stop_loss DECIMAL(15,8),
    take_profit DECIMAL(15,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for trades
CREATE INDEX idx_trades_user ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_pair ON public.trades(pair);

-- ============================================
-- STEP 6: ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: CREATE RLS POLICIES (Non-Recursive!)
-- ============================================

-- ==================
-- USERS POLICIES
-- ==================
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ==================
-- PAYMENT METHODS POLICIES
-- ==================
-- Anyone can view enabled payment methods
CREATE POLICY "Anyone can view enabled payment methods" ON public.payment_methods
    FOR SELECT USING (enabled = true);

-- ==================
-- DEPOSITS POLICIES
-- ==================
-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON public.deposits
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own deposits
CREATE POLICY "Users can create own deposits" ON public.deposits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending deposits
CREATE POLICY "Users can update own pending deposits" ON public.deposits
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- ==================
-- TRADES POLICIES
-- ==================
-- Users can view their own trades
CREATE POLICY "Users can view own trades" ON public.trades
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own trades
CREATE POLICY "Users can create own trades" ON public.trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own open trades
CREATE POLICY "Users can update own trades" ON public.trades
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- STEP 8: CREATE ADMIN ACCESS (Via Service Role)
-- ============================================
-- Note: Admins use the Supabase service_role key which bypasses RLS
-- This is the safest approach - no recursive policy issues

-- ============================================
-- STEP 9: INSERT DEFAULT PAYMENT METHODS
-- ============================================
INSERT INTO public.payment_methods (type, name, symbol, network, address, min_deposit, fee, enabled, display_order) VALUES
    ('crypto', 'Bitcoin', 'BTC', 'Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 50, '0%', true, 1),
    ('crypto', 'Ethereum', 'ETH', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD73', 30, '0%', true, 2),
    ('crypto', 'USDT', 'USDT', 'TRC-20', 'TNYxWh3JhQm3rC2Gt9K7S9fWYHKyQJKLmV', 20, '0%', true, 3),
    ('crypto', 'USDC', 'USDC', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD73', 20, '0%', true, 4),
    ('bank', 'Bank Transfer (USD)', NULL, NULL, NULL, 100, '0%', true, 5),
    ('processor', 'PayPal', NULL, NULL, NULL, 50, '2.9%', true, 6);

-- ============================================
-- STEP 10: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to generate unique order IDs
CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'DEP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 11: CREATE TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_deposits_timestamp
    BEFORE UPDATE ON public.deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trades_timestamp
    BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_methods_timestamp
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 12: GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERIES (Run to check setup)
-- ============================================
-- Check tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check RLS policies:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';

-- Check payment methods:
-- SELECT name, type, enabled FROM public.payment_methods;

-- ============================================
-- SETUP COMPLETE!
-- ============================================
-- Registration flow status values:
--   'pending_verification' = Email not verified yet
--   'pending_kyc'          = Email verified, needs KYC
--   'pending_wallet'       = KYC done, needs wallet
--   'complete'             = Fully registered
-- ============================================
