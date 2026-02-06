-- ============================================
-- NOVA TRADE PLATFORM - SUPABASE SCHEMA
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Go to: https://app.supabase.com → Your Project → SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral ON public.users(referral_code);

-- ============================================
-- PAYMENT METHODS TABLE (Admin configured)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('crypto', 'bank', 'processor')),
    name TEXT NOT NULL,
    symbol TEXT, -- For crypto (BTC, ETH, etc.)
    network TEXT, -- For crypto (ERC-20, TRC-20, etc.)
    address TEXT, -- Crypto address or account ID
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
    confirmations INT DEFAULT 6, -- For crypto
    enabled BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEPOSITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('crypto', 'bank', 'processor')),
    method_id UUID REFERENCES public.payment_methods(id),
    method_name TEXT NOT NULL,
    transaction_ref TEXT, -- User-provided tx hash or reference
    proof_url TEXT, -- Screenshot proof
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    processed_by UUID REFERENCES public.users(id),
    processed_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);

-- ============================================
-- WITHDRAWALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    fee DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL,
    method TEXT NOT NULL,
    wallet_address TEXT,
    bank_name TEXT,
    account_name TEXT,
    account_number TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    processed_by UUID REFERENCES public.users(id),
    processed_at TIMESTAMPTZ,
    tx_hash TEXT, -- Transaction hash for completed withdrawals
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- ============================================
-- TRADES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    pair TEXT NOT NULL, -- e.g., 'EUR/USD', 'BTC/USD'
    market_type TEXT DEFAULT 'forex' CHECK (market_type IN ('forex', 'crypto', 'stocks', 'commodities')),
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    side TEXT DEFAULT 'long' CHECK (side IN ('long', 'short')),
    amount DECIMAL(15,2) NOT NULL, -- Position size in USD
    quantity DECIMAL(20,8), -- Actual quantity (for stocks/crypto)
    entry_price DECIMAL(20,8) NOT NULL,
    current_price DECIMAL(20,8),
    exit_price DECIMAL(20,8),
    leverage INT DEFAULT 1,
    margin_used DECIMAL(15,2),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated', 'pending')),
    pnl DECIMAL(15,2),
    pnl_percentage DECIMAL(10,4),
    stop_loss DECIMAL(20,8),
    take_profit DECIMAL(20,8),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON public.trades(pair);

-- ============================================
-- INVESTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, -- starter, growth, premium, elite
    amount DECIMAL(15,2) NOT NULL,
    roi_percentage DECIMAL(5,2) NOT NULL,
    expected_return DECIMAL(15,2) NOT NULL,
    duration_days INT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    payout_frequency TEXT DEFAULT 'end', -- daily, weekly, end
    total_earned DECIMAL(15,2) DEFAULT 0,
    last_payout_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_user ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON public.investments(status);

-- ============================================
-- TRANSACTIONS LOG TABLE (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'trade_open', 'trade_close', 'investment', 'payout', 'bonus', 'fee', 'admin_credit', 'admin_debit')),
    amount DECIMAL(15,2) NOT NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    reference_id UUID, -- Links to deposits, withdrawals, trades, etc.
    reference_type TEXT,
    description TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

-- ============================================
-- PLATFORM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.platform_settings (key, value, description) VALUES
    ('deposit_instructions', '"After making your deposit, please submit the transaction details below. Our team will verify and credit your account within 1-24 hours."', 'Deposit page instructions'),
    ('support_email', '"support@novatrade.com"', 'Support email address'),
    ('support_whatsapp', '"+1234567890"', 'Support WhatsApp number'),
    ('require_proof', 'true', 'Require payment proof for deposits'),
    ('global_min_deposit', '20', 'Global minimum deposit amount'),
    ('maintenance_mode', 'false', 'Platform maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update all users" ON public.users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Deposits policies
CREATE POLICY "Users can view own deposits" ON public.deposits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create deposits" ON public.deposits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposits" ON public.deposits
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update deposits" ON public.deposits
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Trades policies
CREATE POLICY "Users can view own trades" ON public.trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create trades" ON public.trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades" ON public.trades
    FOR UPDATE USING (auth.uid() = user_id);

-- Payment methods - public read, admin write
CREATE POLICY "Anyone can view enabled payment methods" ON public.payment_methods
    FOR SELECT USING (enabled = true);

CREATE POLICY "Admins can manage payment methods" ON public.payment_methods
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Platform settings - admin only
CREATE POLICY "Admins can manage settings" ON public.platform_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update user balance
CREATE OR REPLACE FUNCTION update_user_balance(
    p_user_id UUID,
    p_amount DECIMAL,
    p_type TEXT, -- 'credit' or 'debit'
    p_description TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
BEGIN
    -- Get current balance
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
        -- Check for sufficient funds
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
        user_id, type, amount, balance_before, balance_after, description
    ) VALUES (
        p_user_id,
        CASE WHEN p_type = 'credit' THEN 'admin_credit' ELSE 'admin_debit' END,
        p_amount,
        v_current_balance,
        v_new_balance,
        p_description
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to confirm deposit
CREATE OR REPLACE FUNCTION confirm_deposit(
    p_deposit_id UUID,
    p_admin_id UUID,
    p_note TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_deposit RECORD;
BEGIN
    -- Get deposit
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
        note = p_note
    WHERE id = p_deposit_id;
    
    -- Credit user balance
    PERFORM update_user_balance(v_deposit.user_id, v_deposit.amount, 'credit', 'Deposit confirmed: ' || v_deposit.method_name);
    
    -- Update total deposited
    UPDATE public.users
    SET total_deposited = total_deposited + v_deposit.amount
    WHERE id = v_deposit.user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER payment_methods_updated_at
    BEFORE UPDATE ON public.payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INSERT DEFAULT PAYMENT METHODS
-- ============================================
INSERT INTO public.payment_methods (type, name, symbol, network, address, icon, min_deposit, confirmations, enabled) VALUES
    ('crypto', 'Bitcoin', 'BTC', 'Bitcoin', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', '₿', 50, 3, true),
    ('crypto', 'Ethereum', 'ETH', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', 'Ξ', 50, 12, true),
    ('crypto', 'Tether (TRC-20)', 'USDT', 'TRC-20', 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9', '₮', 20, 20, true),
    ('crypto', 'Tether (ERC-20)', 'USDT', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', '₮', 50, 12, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
