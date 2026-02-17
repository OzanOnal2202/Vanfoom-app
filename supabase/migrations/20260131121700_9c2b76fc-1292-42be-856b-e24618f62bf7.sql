-- Change points column from integer to numeric to support decimal values
ALTER TABLE public.repair_types 
ALTER COLUMN points TYPE numeric USING points::numeric;