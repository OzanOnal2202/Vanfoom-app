-- Fix 1: Profiles table - Remove overly permissive SELECT and ensure only own profile + admins can view
-- First drop existing SELECT policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recreate proper SELECT policies (restrictive - users see only their own, admins see all)
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Rate limit attempts table - Add policies for edge functions to use via service role
-- The rate_limit_attempts table is used by edge functions with service role key
-- Regular users should NOT have access to this table
-- Service role bypasses RLS, so we just need to ensure RLS is enabled and block all user access

-- Create policy that blocks all authenticated user access (service role bypasses RLS)
CREATE POLICY "No direct user access to rate limits"
ON public.rate_limit_attempts
FOR ALL
USING (false);