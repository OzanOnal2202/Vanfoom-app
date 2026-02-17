-- Create inventory table linked to repair_types
CREATE TABLE public.inventory (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    repair_type_id UUID NOT NULL REFERENCES public.repair_types(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock_level INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(repair_type_id)
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view inventory"
ON public.inventory
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage inventory"
ON public.inventory
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mechanics can update inventory quantities"
ON public.inventory
FOR UPDATE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_inventory_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Initialize inventory for all existing repair_types
INSERT INTO public.inventory (repair_type_id, quantity, min_stock_level)
SELECT id, 0, 5 FROM public.repair_types
ON CONFLICT (repair_type_id) DO NOTHING;

-- Create function to auto-create inventory when new repair_type is added
CREATE OR REPLACE FUNCTION public.create_inventory_for_repair_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.inventory (repair_type_id, quantity, min_stock_level)
    VALUES (NEW.id, 0, 5)
    ON CONFLICT (repair_type_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Trigger to auto-create inventory
CREATE TRIGGER create_inventory_on_repair_type_insert
AFTER INSERT ON public.repair_types
FOR EACH ROW
EXECUTE FUNCTION public.create_inventory_for_repair_type();

-- Function to deduct inventory when work registration is completed
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Only deduct if completed changed from false to true
    IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) THEN
        UPDATE public.inventory
        SET quantity = GREATEST(quantity - 1, 0)
        WHERE repair_type_id = NEW.repair_type_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger for auto-deduction
CREATE TRIGGER deduct_inventory_on_work_completion
AFTER UPDATE ON public.work_registrations
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_completion();