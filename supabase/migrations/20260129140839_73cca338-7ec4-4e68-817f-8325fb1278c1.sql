-- Create a new enum for the complete workflow
CREATE TYPE public.bike_workflow_status AS ENUM (
  'diagnose_nodig',
  'wacht_op_akkoord',
  'klaar_voor_reparatie',
  'in_reparatie',
  'afgerond'
);

-- Add table_number and workflow_status to bikes
ALTER TABLE public.bikes 
ADD COLUMN table_number text,
ADD COLUMN workflow_status public.bike_workflow_status NOT NULL DEFAULT 'diagnose_nodig';

-- Enable realtime for bikes table so TV display can update in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.bikes;