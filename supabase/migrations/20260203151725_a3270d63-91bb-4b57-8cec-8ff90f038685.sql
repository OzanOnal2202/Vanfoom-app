-- Allow monteurs (mechanics) to view profiles for displaying task creator names
CREATE POLICY "Monteurs can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'monteur'::app_role));