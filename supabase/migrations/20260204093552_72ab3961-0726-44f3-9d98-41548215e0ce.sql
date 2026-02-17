-- Drop the current policy
DROP POLICY IF EXISTS "Mechanics can update bikes to claim or work on them" ON public.bikes;

-- Create a more permissive policy for mechanics
-- USING clause: controls which rows the user can see/update (the OLD row)
-- WITH CHECK clause: controls what values the user can write (the NEW row)
CREATE POLICY "Mechanics can update bikes to claim or work on them"
ON public.bikes
FOR UPDATE
USING (
  has_role(auth.uid(), 'monteur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'monteur'::app_role) AND
  (current_mechanic_id IS NULL OR current_mechanic_id = auth.uid())
);