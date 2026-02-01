-- ============================================
-- FIX: RLS Policies for Users Table
-- ============================================
-- Run this SQL to fix the infinite recursion RLS issue
-- This replaces broken admin policies with safe ones

-- Step 1: Drop ALL existing policies on users table
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Allow users to view own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON users;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON users;

-- Step 2: Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 3: Create NEW non-recursive policies
-- These use auth.uid() directly instead of querying the users table

-- SELECT: Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT 
  USING (auth.uid() = id);

-- UPDATE: Users can update their own profile  
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE 
  USING (auth.uid() = id);

-- INSERT: Users can create their own profile (during signup)
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify policies were created:
-- SELECT * FROM pg_policies WHERE tablename = 'users';

-- ============================================
-- WHY THE OLD POLICIES CAUSED ERRORS
-- ============================================
-- The old admin policies like:
--   USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin')
-- 
-- This caused INFINITE RECURSION because:
-- 1. User tries to INSERT into users
-- 2. Policy check runs SELECT on users to check role  
-- 3. That SELECT triggers another policy check
-- 4. Which runs another SELECT... and so on forever
--
-- The FIX uses auth.uid() = id directly, which doesn't query the table.
