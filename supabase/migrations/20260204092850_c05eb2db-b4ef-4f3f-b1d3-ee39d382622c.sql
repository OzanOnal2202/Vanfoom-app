-- Drop the existing restrictive policy for mechanics
DROP POLICY IF EXISTS "Mechanics can update workflow status on assigned bikes" ON public.bikes;

-- Create a new policy that allows mechanics to:
-- 1. Update bikes they are already assigned to
-- 2. Update bikes with no mechanic assigned (to claim them)
CREATE POLICY "Mechanics can update bikes to claim or work on them"
ON public.bikes
FOR UPDATE
USING (
  has_role(auth.uid(), 'monteur'::app_role) AND 
  (current_mechanic_id IS NULL OR current_mechanic_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'monteur'::app_role) AND 
  (current_mechanic_id IS NULL OR current_mechanic_id = auth.uid())
);