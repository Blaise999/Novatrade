-- ============================================
-- BOT TRADING SYSTEM — Full Schema
-- ============================================

-- Parent table: every bot instance
CREATE TABLE IF NOT EXISTS trading_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_type TEXT NOT NULL CHECK (bot_type IN ('dca','grid')),
  name TEXT NOT NULL,
  pair TEXT NOT NULL,            -- e.g. 'BTC/USDT'
  status TEXT NOT NULL DEFAULT 'stopped' CHECK (status IN ('running','paused','stopped','error')),
  invested_amount DECIMAL(18,8) DEFAULT 0,
  current_value DECIMAL(18,8) DEFAULT 0,
  total_pnl DECIMAL(18,8) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DCA bot configuration
CREATE TABLE IF NOT EXISTS dca_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL UNIQUE REFERENCES trading_bots(id) ON DELETE CASCADE,
  order_amount DECIMAL(18,8) NOT NULL,                 -- $ per regular buy
  frequency TEXT NOT NULL DEFAULT '4h',                 -- 1m,5m,15m,1h,4h,12h,daily,weekly,monthly
  take_profit_pct DECIMAL(8,4) DEFAULT 3.0,            -- sell-all trigger %
  stop_loss_pct DECIMAL(8,4),                          -- optional SL %
  trailing_tp_enabled BOOLEAN DEFAULT FALSE,
  trailing_tp_deviation DECIMAL(8,4) DEFAULT 1.0,      -- % retrace from peak
  safety_orders_enabled BOOLEAN DEFAULT FALSE,
  max_safety_orders INTEGER DEFAULT 5,
  safety_order_size DECIMAL(18,8) DEFAULT 0,           -- base safety order size
  safety_order_step_pct DECIMAL(8,4) DEFAULT 2.0,      -- price drop % to trigger
  safety_order_step_scale DECIMAL(8,4) DEFAULT 1.0,    -- step multiplier per level
  safety_order_volume_scale DECIMAL(8,4) DEFAULT 1.5,  -- size multiplier per level
  -- Runtime state
  current_avg_price DECIMAL(18,8) DEFAULT 0,
  total_base_bought DECIMAL(18,8) DEFAULT 0,
  total_quote_spent DECIMAL(18,8) DEFAULT 0,
  active_safety_count INTEGER DEFAULT 0,
  peak_profit_pct DECIMAL(8,4) DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  last_buy_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grid bot configuration
CREATE TABLE IF NOT EXISTS grid_bot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL UNIQUE REFERENCES trading_bots(id) ON DELETE CASCADE,
  upper_price DECIMAL(18,8) NOT NULL,
  lower_price DECIMAL(18,8) NOT NULL,
  grid_count INTEGER NOT NULL DEFAULT 10,
  grid_type TEXT NOT NULL DEFAULT 'arithmetic' CHECK (grid_type IN ('arithmetic','geometric')),
  total_investment DECIMAL(18,8) NOT NULL,
  per_grid_amount DECIMAL(18,8) NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'neutral' CHECK (strategy IN ('neutral','long','short')),
  stop_upper_price DECIMAL(18,8),
  stop_lower_price DECIMAL(18,8),
  -- Runtime state
  grid_profit DECIMAL(18,8) DEFAULT 0,
  float_pnl DECIMAL(18,8) DEFAULT 0,
  total_base_held DECIMAL(18,8) DEFAULT 0,
  avg_buy_price DECIMAL(18,8) DEFAULT 0,
  completed_cycles INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual grid price levels
CREATE TABLE IF NOT EXISTS grid_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  level_index INTEGER NOT NULL,
  price DECIMAL(18,8) NOT NULL,
  buy_filled BOOLEAN DEFAULT FALSE,
  sell_filled BOOLEAN DEFAULT FALSE,
  buy_order_id UUID,
  sell_order_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All orders placed by bots
CREATE TABLE IF NOT EXISTS bot_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  role TEXT NOT NULL CHECK (role IN (
    'dca_base','dca_safety','dca_take_profit','dca_stop_loss',
    'grid_buy','grid_sell'
  )),
  quantity DECIMAL(18,8) NOT NULL,
  price DECIMAL(18,8) NOT NULL,
  total DECIMAL(18,8) NOT NULL,
  fee DECIMAL(18,8) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'filled' CHECK (status IN ('pending','filled','cancelled')),
  grid_level INTEGER,
  safety_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log / audit trail
CREATE TABLE IF NOT EXISTS bot_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trading_bots_user ON trading_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_bots_status ON trading_bots(status);
CREATE INDEX IF NOT EXISTS idx_bot_orders_bot ON bot_orders(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_orders_user ON bot_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_grid_levels_bot ON grid_levels(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_activity_bot ON bot_activity_log(bot_id);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_bot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_trading_bots_updated ON trading_bots;
CREATE TRIGGER trg_trading_bots_updated
  BEFORE UPDATE ON trading_bots
  FOR EACH ROW EXECUTE FUNCTION update_bot_timestamp();

-- RLS
ALTER TABLE trading_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dca_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own bots" ON trading_bots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own dca config" ON dca_bot_config FOR ALL USING (
  bot_id IN (SELECT id FROM trading_bots WHERE user_id = auth.uid())
);
CREATE POLICY "Users see own grid config" ON grid_bot_config FOR ALL USING (
  bot_id IN (SELECT id FROM trading_bots WHERE user_id = auth.uid())
);
CREATE POLICY "Users see own grid levels" ON grid_levels FOR ALL USING (
  bot_id IN (SELECT id FROM trading_bots WHERE user_id = auth.uid())
);
CREATE POLICY "Users see own bot orders" ON bot_orders FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users see own bot activity" ON bot_activity_log FOR ALL USING (
  bot_id IN (SELECT id FROM trading_bots WHERE user_id = auth.uid())
);
