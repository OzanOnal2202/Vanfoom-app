-- Add price column to repair_types table
ALTER TABLE public.repair_types 
ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Update existing repair types with example prices (can be adjusted later by admin)
UPDATE public.repair_types SET price = 25.00 WHERE name = 'Bandvervanging voor';
UPDATE public.repair_types SET price = 30.00 WHERE name = 'Bandvervanging achter';
UPDATE public.repair_types SET price = 35.00 WHERE name = 'Ketting vervangen';
UPDATE public.repair_types SET price = 45.00 WHERE name = 'Lager vervangen';
UPDATE public.repair_types SET price = 75.00 WHERE name = 'Accu vervanging';
UPDATE public.repair_types SET price = 55.00 WHERE name = 'Elektronica diagnose';
UPDATE public.repair_types SET price = 40.00 WHERE name = 'Frame inspectie';
UPDATE public.repair_types SET price = 120.00 WHERE name = 'Motor reparatie';
UPDATE public.repair_types SET price = 20.00 WHERE name = 'Remblokken vervangen';
UPDATE public.repair_types SET price = 50.00 WHERE name = 'Slot reparatie';
UPDATE public.repair_types SET price = 15.00 WHERE name = 'Software update';
UPDATE public.repair_types SET price = 35.00 WHERE name = 'Spaken vervangen';
UPDATE public.repair_types SET price = 65.00 WHERE name = 'Stuur/cockpit reparatie';
UPDATE public.repair_types SET price = 20.00 WHERE name = 'Versnelling afstellen';
UPDATE public.repair_types SET price = 150.00 WHERE name = 'Complete servicebeurt';

COMMENT ON COLUMN public.repair_types.price IS 'Price in euros for this repair type';