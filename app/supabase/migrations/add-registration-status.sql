-- ============================================
-- MIGRATION: Add Registration Status Fields
-- ============================================
-- Run this SQL if you already have the users table created
-- This adds the registration_status and wallet_address columns

-- Add registration_status column (tracks onboarding progress)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS registration_status TEXT 
DEFAULT 'complete' 
CHECK (registration_status IN ('pending_verification', 'pending_kyc', 'pending_wallet', 'complete'));

-- Add wallet_address column (stores connected crypto wallet)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Update existing users to have 'complete' registration status
-- (Since they already finished registration before this feature existed)
UPDATE public.users 
SET registration_status = 'complete' 
WHERE registration_status IS NULL;

-- ============================================
-- EXPLANATION OF REGISTRATION STATUSES
-- ============================================
-- 'pending_verification' : User signed up but hasn't verified email yet
-- 'pending_kyc'          : Email verified, KYC not completed
-- 'pending_wallet'       : KYC done, wallet not connected  
-- 'complete'             : Fully registered, can access all features
