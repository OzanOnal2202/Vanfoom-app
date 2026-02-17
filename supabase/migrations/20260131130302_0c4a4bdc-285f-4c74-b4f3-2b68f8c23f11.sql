-- Remove S4 and X4 model mappings from repair_type_models table
DELETE FROM public.repair_type_models WHERE model IN ('S4', 'X4');