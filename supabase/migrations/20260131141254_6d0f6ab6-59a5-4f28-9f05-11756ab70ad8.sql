-- Add 'foh' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'foh';

-- Note: RLS policies for user_roles already use has_role() which will work with the new role
-- The 'foh' role will have similar access to 'monteur' for most tables