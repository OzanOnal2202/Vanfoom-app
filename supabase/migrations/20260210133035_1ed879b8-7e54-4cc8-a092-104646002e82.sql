
-- Create a function that returns profiles with birthdays today (only returns id and full_name, not the actual date)
CREATE OR REPLACE FUNCTION public.get_todays_birthdays()
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  WHERE p.date_of_birth IS NOT NULL
    AND EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM p.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
    AND p.is_active = true;
$$;
