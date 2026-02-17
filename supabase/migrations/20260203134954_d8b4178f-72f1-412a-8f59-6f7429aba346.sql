-- Add diagnosed_by column to track who performed the diagnosis
ALTER TABLE public.bikes 
ADD COLUMN diagnosed_by uuid REFERENCES public.profiles(id);

-- Add diagnosed_at timestamp
ALTER TABLE public.bikes 
ADD COLUMN diagnosed_at timestamp with time zone;

-- Comment for clarity
COMMENT ON COLUMN public.bikes.diagnosed_by IS 'ID of the mechanic who performed the diagnosis';
COMMENT ON COLUMN public.bikes.diagnosed_at IS 'Timestamp when the diagnosis was completed';