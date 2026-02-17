-- Create admin_settings table for storing configurable admin settings
CREATE TABLE public.admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key text UNIQUE NOT NULL,
    setting_value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only the specific super admin can view and manage settings
CREATE POLICY "Super admin can view settings"
ON public.admin_settings FOR SELECT
USING (auth.uid() = '93727e33-2681-415c-a5bd-0ccc513c25ed'::uuid);

CREATE POLICY "Super admin can insert settings"
ON public.admin_settings FOR INSERT
WITH CHECK (auth.uid() = '93727e33-2681-415c-a5bd-0ccc513c25ed'::uuid);

CREATE POLICY "Super admin can update settings"
ON public.admin_settings FOR UPDATE
USING (auth.uid() = '93727e33-2681-415c-a5bd-0ccc513c25ed'::uuid);

CREATE POLICY "Super admin can delete settings"
ON public.admin_settings FOR DELETE
USING (auth.uid() = '93727e33-2681-415c-a5bd-0ccc513c25ed'::uuid);

-- Insert initial admin password (will be updated via UI)
-- Using a placeholder that should be changed immediately
INSERT INTO public.admin_settings (setting_key, setting_value, updated_by)
VALUES ('admin_promotion_password', 'CHANGE_ME_IMMEDIATELY', '93727e33-2681-415c-a5bd-0ccc513c25ed');