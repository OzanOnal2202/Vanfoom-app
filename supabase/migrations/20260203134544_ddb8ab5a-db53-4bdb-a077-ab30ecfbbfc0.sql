-- Allow FOH users to view all profiles (needed for task assignment)
CREATE POLICY "FOH can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'foh'::app_role));