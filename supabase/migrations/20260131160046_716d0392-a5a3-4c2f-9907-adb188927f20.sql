-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view appropriate bikes" ON public.bikes;

-- Create a new policy that allows all authenticated users to view bikes
-- This is needed for the TV display and general workshop visibility
CREATE POLICY "Authenticated users can view bikes"
ON public.bikes
FOR SELECT
TO authenticated
USING (true);

-- Note: The bikes_safe view still protects customer_phone for monteurs