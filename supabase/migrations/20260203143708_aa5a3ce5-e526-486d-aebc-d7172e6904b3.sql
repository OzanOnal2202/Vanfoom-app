-- Add bike_id column to foh_tasks to optionally link a task to a bike
ALTER TABLE public.foh_tasks 
ADD COLUMN bike_id uuid REFERENCES public.bikes(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_foh_tasks_bike_id ON public.foh_tasks(bike_id);