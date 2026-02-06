-- ============================================
-- BOT ACTIVATION KEYS
-- ============================================

CREATE TABLE IF NOT EXISTS bot_activation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_key TEXT NOT NULL UNIQUE,
  bot_type TEXT NOT NULL CHECK (bot_type IN ('dca','grid')),
  status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','active','revoked')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  generated_by TEXT,                       -- admin who generated
  activated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which bots a user has activated
CREATE TABLE IF NOT EXISTS user_bot_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_type TEXT NOT NULL CHECK (bot_type IN ('dca','grid')),
  activation_key_id UUID REFERENCES bot_activation_keys(id),
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bot_type)
);

CREATE INDEX IF NOT EXISTS idx_activation_keys_key ON bot_activation_keys(activation_key);
CREATE INDEX IF NOT EXISTS idx_activation_keys_status ON bot_activation_keys(status);
CREATE INDEX IF NOT EXISTS idx_activation_keys_user ON bot_activation_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bot_access_user ON user_bot_access(user_id);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_activation_key_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_activation_keys_updated ON bot_activation_keys;
CREATE TRIGGER trg_activation_keys_updated
  BEFORE UPDATE ON bot_activation_keys
  FOR EACH ROW EXECUTE FUNCTION update_activation_key_timestamp();

-- RLS
ALTER TABLE bot_activation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bot_access ENABLE ROW LEVEL SECURITY;

-- Users can read only their own access
CREATE POLICY "Users see own bot access" ON user_bot_access FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (service role bypasses RLS)
CREATE POLICY "Service role full access keys" ON bot_activation_keys FOR ALL USING (true);
CREATE POLICY "Service role full access bot_access" ON user_bot_access FOR ALL USING (true);
