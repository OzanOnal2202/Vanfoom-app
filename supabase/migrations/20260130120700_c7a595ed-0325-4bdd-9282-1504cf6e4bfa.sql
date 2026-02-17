-- Add is_active column to profiles
ALTER TABLE public.profiles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Create login_logs table to track user logins
CREATE TABLE public.login_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logged_in_at timestamp with time zone NOT NULL DEFAULT now(),
    ip_address text,
    user_agent text
);

-- Enable RLS on login_logs
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX idx_login_logs_logged_in_at ON public.login_logs(logged_in_at);

-- RLS policies for login_logs
CREATE POLICY "Users can view their own login logs"
ON public.login_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all login logs"
ON public.login_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can insert their own login log"
ON public.login_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policy for admins to update profiles (for is_active)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));