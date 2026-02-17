
-- Update the deduct trigger to always deduct from individual inventory item, not from group
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Only deduct if completed changed from false to true
    IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) THEN
        -- Always deduct from individual inventory item
        UPDATE public.inventory
        SET quantity = GREATEST(quantity - 1, 0)
        WHERE repair_type_id = NEW.repair_type_id;
    END IF;
    RETURN NEW;
END;
$function$;
