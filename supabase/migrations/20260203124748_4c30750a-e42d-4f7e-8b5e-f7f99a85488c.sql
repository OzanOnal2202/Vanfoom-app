-- Create table for call history
CREATE TABLE public.bike_call_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
    called_by UUID NOT NULL REFERENCES public.profiles(id),
    called_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    notes TEXT
);

-- Enable RLS
ALTER TABLE public.bike_call_history ENABLE ROW LEVEL SECURITY;

-- Policies: FOH and Admins can view all call history
CREATE POLICY "FOH and Admins can view call history"
ON public.bike_call_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'foh'::app_role));

-- FOH and Admins can insert call history
CREATE POLICY "FOH and Admins can insert call history"
ON public.bike_call_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'foh'::app_role));

-- Admins can delete call history
CREATE POLICY "Admins can delete call history"
ON public.bike_call_history
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_bike_call_history_bike_id ON public.bike_call_history(bike_id);
CREATE INDEX idx_bike_call_history_called_at ON public.bike_call_history(called_at DESC);