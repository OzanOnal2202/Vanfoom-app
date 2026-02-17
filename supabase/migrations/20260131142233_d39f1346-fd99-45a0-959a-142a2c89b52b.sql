-- Create table for configurable call statuses (admin configurable)
CREATE TABLE public.table_call_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#fbbf24', -- tailwind yellow-400
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.table_call_statuses ENABLE ROW LEVEL SECURITY;

-- Admins can manage call statuses
CREATE POLICY "Admins can manage call statuses"
ON public.table_call_statuses
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can view call statuses
CREATE POLICY "Authenticated users can view call statuses"
ON public.table_call_statuses
FOR SELECT
USING (true);

-- Insert default call statuses
INSERT INTO public.table_call_statuses (name, name_en, color, sort_order) VALUES
  ('Niet gebeld', 'Not called', '#9ca3af', 0),
  ('Moet gebeld worden', 'Needs calling', '#fbbf24', 1),
  ('Opnieuw bellen', 'Call again', '#f97316', 2),
  ('Gebeld - wacht op reactie', 'Called - awaiting response', '#3b82f6', 3),
  ('Klant bereikt', 'Customer reached', '#22c55e', 4);

-- Add call_status_id and customer_phone to bikes table
ALTER TABLE public.bikes
ADD COLUMN call_status_id UUID REFERENCES public.table_call_statuses(id),
ADD COLUMN customer_phone TEXT;

-- Create index for better query performance
CREATE INDEX idx_bikes_call_status ON public.bikes(call_status_id);
CREATE INDEX idx_bikes_table_number ON public.bikes(table_number);