
-- Fix: restrict DELETE on work_registrations to owner, admin, or FOH
DROP POLICY IF EXISTS "Authenticated users can delete work registrations" ON public.work_registrations;

CREATE POLICY "Owners admins and FOH can delete work registrations"
ON public.work_registrations
FOR DELETE
USING (
  auth.uid() = mechanic_id OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'foh'::app_role)
);

-- Track who deleted/modified work registrations by adding deleted_by tracking
ALTER TABLE public.work_registrations 
ADD COLUMN IF NOT EXISTS last_modified_by uuid,
ADD COLUMN IF NOT EXISTS last_modified_at timestamptz;

-- Create trigger to auto-set last_modified_by and last_modified_at on update
CREATE OR REPLACE FUNCTION public.track_work_registration_modifier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified_by = auth.uid();
    NEW.last_modified_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER track_work_registration_changes
BEFORE UPDATE ON public.work_registrations
FOR EACH ROW
EXECUTE FUNCTION public.track_work_registration_modifier();
