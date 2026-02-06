-- ============================================
-- ADMIN USER SETUP FOR NOVATRADE
-- ============================================
-- Run this in your Supabase SQL Editor AFTER doing Step 1 below.
--
-- STEP 1 (do this in the Supabase Dashboard, NOT here):
--   Go to: Authentication > Users > "Add User" > "Create New User"
--   Email:    westadmin@novatrade.com   (or whatever email you want)
--   Password: west999
--   Check "Auto Confirm User" so you skip email verification
--   Click "Create User"
--   Copy the UUID it gives you — you'll paste it below.
--
-- STEP 2: Replace the UUID below with the one from Step 1, then run this SQL.
-- ============================================

-- ⚠️  REPLACE THIS with the actual UUID from Step 1
DO $$
DECLARE
  admin_uuid UUID := '00000000-0000-0000-0000-000000000000';  -- ← paste your UUID here
BEGIN

  -- Insert into users table (or update if row already exists)
  INSERT INTO public.users (id, email, first_name, last_name, role, is_active, kyc_status, registration_status)
  VALUES (
    admin_uuid,
    'westadmin@novatrade.com',   -- must match the email from Step 1
    'West',
    'Admin',
    'admin',
    true,
    'verified',
    'complete'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    first_name = 'West',
    last_name = 'Admin',
    is_active = true;

  RAISE NOTICE 'Admin user created/updated successfully!';
END $$;

-- Verify it worked
SELECT id, email, first_name, last_name, role, is_active 
FROM public.users 
WHERE role = 'admin';
