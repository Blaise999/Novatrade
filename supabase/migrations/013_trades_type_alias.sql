-- 013_trades_type_alias.sql
-- ADDITIVE ONLY — safe to rerun
-- Ensures trades.type exists for older code paths (type/direction aliases)

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pair TEXT;

-- Keep aliases in sync
UPDATE public.trades SET type = direction WHERE type IS NULL AND direction IS NOT NULL;
UPDATE public.trades SET direction = type WHERE direction IS NULL AND type IS NOT NULL;

UPDATE public.trades SET symbol = pair WHERE symbol IS NULL AND pair IS NOT NULL;
UPDATE public.trades SET pair = symbol WHERE pair IS NULL AND symbol IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trades_type ON public.trades(type);
