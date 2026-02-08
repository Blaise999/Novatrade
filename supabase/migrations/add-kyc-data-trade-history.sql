-- ================================================
-- MIGRATION: Add KYC data storage + trade history improvements
-- Run this after COMPLETE-FINAL-SETUP.sql
-- ================================================

-- Add kyc_data JSONB column to users table for storing KYC form data
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_data JSONB DEFAULT NULL;

-- Add symbol column to trades table if not exists (for history search)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS symbol TEXT;

-- Add opened_at and closed_at columns if not exists
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Create index on symbol for search
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON public.trades(symbol);

-- Create index on user_id + market_type for filtered history queries
CREATE INDEX IF NOT EXISTS idx_trades_user_market ON public.trades(user_id, market_type);

-- Allow KYC data to be updated by authenticated users (their own row only)
-- This is handled by existing RLS policies on the users table

COMMENT ON COLUMN public.users.kyc_data IS 'Stores KYC submission data as JSON: personal info, address, document references';
