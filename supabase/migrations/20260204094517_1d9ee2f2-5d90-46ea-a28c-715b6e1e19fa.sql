-- Create function to clear table_number when bike is completed
CREATE OR REPLACE FUNCTION public.clear_table_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- If workflow_status changed to 'afgerond', clear the table_number
    IF NEW.workflow_status = 'afgerond' AND (OLD.workflow_status IS NULL OR OLD.workflow_status != 'afgerond') THEN
        NEW.table_number := NULL;
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to automatically clear table when bike is completed
CREATE TRIGGER clear_table_on_bike_completion
    BEFORE UPDATE ON public.bikes
    FOR EACH ROW
    EXECUTE FUNCTION public.clear_table_on_completion();