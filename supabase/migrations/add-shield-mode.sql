-- ============================================
-- SHIELD MODE MIGRATION
-- Adds Shield Mode (Synthetic Pause) support to trades table
-- ============================================

-- Add shield mode columns to trades table
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS shield_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS shield_snap_price DECIMAL(20,8);
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS shield_snap_value DECIMAL(15,2);
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS shield_activated_at TIMESTAMPTZ;

-- Create index for finding shielded positions
CREATE INDEX IF NOT EXISTS idx_trades_shield ON public.trades(shield_enabled) WHERE shield_enabled = true;

-- Add comment explaining shield mode
COMMENT ON COLUMN public.trades.shield_enabled IS 'Whether shield (synthetic pause) is active on this position';
COMMENT ON COLUMN public.trades.shield_snap_price IS 'Price at which shield was activated (frozen display price)';
COMMENT ON COLUMN public.trades.shield_snap_value IS 'Portfolio value locked when shield was activated';
COMMENT ON COLUMN public.trades.shield_activated_at IS 'Timestamp when shield was turned on';

-- Function to activate shield on a position
CREATE OR REPLACE FUNCTION activate_shield(
    p_trade_id UUID,
    p_snap_price DECIMAL,
    p_snap_value DECIMAL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.trades
    SET 
        shield_enabled = true,
        shield_snap_price = p_snap_price,
        shield_snap_value = p_snap_value,
        shield_activated_at = NOW()
    WHERE id = p_trade_id AND status = 'open';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate shield on a position
CREATE OR REPLACE FUNCTION deactivate_shield(
    p_trade_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.trades
    SET 
        shield_enabled = false,
        shield_snap_price = NULL,
        shield_snap_value = NULL,
        shield_activated_at = NULL
    WHERE id = p_trade_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION activate_shield TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_shield TO authenticated;
