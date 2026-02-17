-- Add policy to allow authenticated users to delete work registrations 
-- This is needed for FOH to reject repairs from diagnosis
CREATE POLICY "Authenticated users can delete work registrations"
ON public.work_registrations
FOR DELETE
USING (true);