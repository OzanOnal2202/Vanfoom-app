
-- Add stock fields to inventory_groups
ALTER TABLE public.inventory_groups ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_groups ADD COLUMN min_stock_level INTEGER NOT NULL DEFAULT 5;

-- Update the deduction function to support group-level stock
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Only deduct if completed changed from false to true
    IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) THEN
        -- Check if this inventory item belongs to a group
        SELECT i.group_id INTO v_group_id
        FROM public.inventory i
        WHERE i.repair_type_id = NEW.repair_type_id;

        IF v_group_id IS NOT NULL THEN
            -- Deduct from the group
            UPDATE public.inventory_groups
            SET quantity = GREATEST(quantity - 1, 0)
            WHERE id = v_group_id;
        ELSE
            -- Deduct from individual inventory
            UPDATE public.inventory
            SET quantity = GREATEST(quantity - 1, 0)
            WHERE repair_type_id = NEW.repair_type_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
