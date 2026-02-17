-- Fix 1: profiles table - Change policies from RESTRICTIVE to PERMISSIVE
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate as PERMISSIVE policies (default) so either condition can grant access
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Fix 2: bikes table - Restrict customer_phone visibility
-- Create a view that hides customer_phone for non-admins and non-assigned mechanics
-- First, drop existing SELECT policy that exposes all data
DROP POLICY IF EXISTS "Authenticated users can view bikes" ON public.bikes;

-- Create new restrictive policy that limits access based on role
-- Admins and FOH can see all bikes, mechanics can only see bikes assigned to them
CREATE POLICY "Users can view appropriate bikes" 
ON public.bikes 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'foh'::app_role) OR
  current_mechanic_id = auth.uid()
);

-- Create a secure view for bikes that hides customer_phone from non-admins
CREATE OR REPLACE VIEW public.bikes_safe 
WITH (security_invoker = on) AS
SELECT 
  id,
  frame_number,
  model,
  status,
  workflow_status,
  table_number,
  current_mechanic_id,
  call_status_id,
  created_at,
  updated_at,
  CASE 
    WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'foh'::app_role)
    THEN customer_phone 
    ELSE NULL 
  END as customer_phone
FROM public.bikes;