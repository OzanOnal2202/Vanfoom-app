
-- Create a limited profiles view that only exposes non-sensitive fields
-- This view does NOT use security_invoker so it bypasses RLS on the base table
CREATE OR REPLACE VIEW public.profiles_limited AS
SELECT 
  id,
  full_name,
  job_function,
  is_active,
  is_approved,
  email
FROM public.profiles;

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_limited TO authenticated;
GRANT SELECT ON public.profiles_limited TO anon;

-- Drop overly permissive SELECT policies for FOH and Monteurs
DROP POLICY IF EXISTS "FOH can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Monteurs can view all profiles" ON public.profiles;
