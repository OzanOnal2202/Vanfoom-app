-- Allow mechanics (monteur) to insert bikes as well
CREATE POLICY "Mechanics can insert bikes"
ON public.bikes
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'monteur'::app_role));

-- Add diagnose_bezig to the bike_workflow_status enum (alias for diagnose_nodig)
-- Since 'diagnose_bezig' should behave the same as 'diagnose_nodig', we'll add it as a new value
ALTER TYPE public.bike_workflow_status ADD VALUE IF NOT EXISTS 'diagnose_bezig' AFTER 'diagnose_nodig';