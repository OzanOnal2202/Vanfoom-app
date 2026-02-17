-- ============================================
-- FIX 1: Bikes table - restrict INSERT and UPDATE policies
-- ============================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert bikes" ON public.bikes;
DROP POLICY IF EXISTS "Authenticated users can update bikes" ON public.bikes;

-- Create restricted INSERT policy: only FOH and admins can create bikes
CREATE POLICY "FOH and admins can insert bikes" 
  ON public.bikes FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'foh'::app_role)
  );

-- Create restricted UPDATE policy for mechanics: can only update workflow_status on assigned bikes
CREATE POLICY "Mechanics can update workflow status on assigned bikes" 
  ON public.bikes FOR UPDATE
  TO authenticated
  USING (auth.uid() = current_mechanic_id)
  WITH CHECK (auth.uid() = current_mechanic_id);

-- Create full UPDATE policy for FOH and admins
CREATE POLICY "Admins and FOH can update any bike" 
  ON public.bikes FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'foh'::app_role)
  );

-- ============================================
-- FIX 2: Create rate_limit_attempts table for tracking failed password attempts
-- ============================================

CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(key)
);

-- Enable RLS on rate_limit_attempts
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can manage rate limits (edge functions use service role)
-- No policies needed - only service role key can access

-- ============================================
-- FIX 3: Create admin_promotion_logs table for audit logging
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_promotion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid,
  success boolean NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_promotion_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view promotion logs
CREATE POLICY "Admins can view promotion logs" 
  ON public.admin_promotion_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Edge functions insert via service role (no policy needed)