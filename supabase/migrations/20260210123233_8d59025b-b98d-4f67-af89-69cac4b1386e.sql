
-- Create inventory groups table
CREATE TABLE public.inventory_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_groups ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage inventory groups"
ON public.inventory_groups FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view inventory groups"
ON public.inventory_groups FOR SELECT
USING (true);

-- Add group_id to inventory
ALTER TABLE public.inventory ADD COLUMN group_id UUID REFERENCES public.inventory_groups(id) ON DELETE SET NULL;
