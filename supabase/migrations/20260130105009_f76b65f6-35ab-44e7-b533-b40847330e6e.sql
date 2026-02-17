-- First delete all work_registrations to avoid FK constraint issues
DELETE FROM public.work_registrations;

-- Delete from repair_type_models if it exists (from previous partial migration)
DROP TABLE IF EXISTS public.repair_type_models;

-- Now delete all repair types
DELETE FROM public.repair_types;

-- Create junction table for repair types per model
CREATE TABLE public.repair_type_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  repair_type_id UUID NOT NULL REFERENCES public.repair_types(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(repair_type_id, model)
);

-- Enable RLS
ALTER TABLE public.repair_type_models ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view
CREATE POLICY "Authenticated users can view repair type models"
ON public.repair_type_models
FOR SELECT
USING (true);

-- Allow admins to manage
CREATE POLICY "Admins can manage repair type models"
ON public.repair_type_models
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert S1 repairs
INSERT INTO public.repair_types (name, description, price, points) VALUES
('Trapper gebruikt', 'Trapper vervangen (gebruikt)', 25.00, 2),
('Scherm', 'Scherm vervangen', 39.00, 3),
('Trapas S1', 'Trapas vervangen S1', 65.00, 4),
('Cartridge Accu S1', 'Cartridge accu vervangen S1', 149.00, 5),
('Cartridge S1', 'Cartridge vervangen S1', 199.00, 6),
('Motorkabel', 'Motorkabel vervangen', 199.00, 6),
('Accu S1', 'Accu vervangen S1', 450.00, 8);

-- Insert S2 repairs
INSERT INTO public.repair_types (name, description, price, points) VALUES
('Klein onderhoud', 'Remmen stellen & ketting', 25.00, 2),
('Stuur', 'Stuur vervangen', 39.00, 3),
('Remklauw S2', 'Remklauw vervangen S2', 39.00, 3),
('Button S2', 'Button vervangen S2', 39.00, 3),
('Kicklock S2', 'Kicklock vervangen S2', 125.00, 5),
('Laadpoort S2', 'Laadpoort vervangen S2', 159.00, 5),
('Cartridge S2', 'Cartridge vervangen S2', 349.00, 7),
('Socket S2', 'Socket vervangen S2', 449.00, 8),
('Remhendel S2', 'Remhendel vervangen S2', 25.00, 2),
('Remkabel voor', 'Remkabel voor vervangen', 35.00, 2),
('Remkabel achter', 'Remkabel achter vervangen', 85.00, 4),
('Motorklepje', 'Motorklepje vervangen', 25.00, 2),
('Accuklepje', 'Accuklepje vervangen', 25.00, 2),
('Lamp voor + achter', 'Lamp voor en achter vervangen', 25.00, 2),
('Remschijf', 'Remschijf vervangen', 39.00, 3),
('Kettingkast compleet', 'Kettingkast compleet vervangen', 75.00, 4),
('Trapas S2', 'Trapas vervangen S2', 99.00, 4),
('Trappers per stuk', 'Trapper vervangen per stuk', 25.00, 2),
('Achterwiel S2', 'Achterwiel vervangen S2', 159.00, 5),
('Crank per stuk', 'Crank vervangen per stuk', 55.00, 3),
('Balhoofdlager S2', 'Balhoofdlager vervangen S2', 39.00, 3),
('Rekjes achter', 'Rekjes achter plaatsen', 49.00, 3);

-- Insert X2 repairs
INSERT INTO public.repair_types (name, description, price, points) VALUES
('Laadpoort X2', 'Laadpoort vervangen X2', 259.00, 6),
('Spatbord X2', 'Spatbord vervangen X2', 39.00, 3),
('Speaker X2', 'Speaker vervangen X2', 179.00, 5);

-- Insert S3/X3 repairs
INSERT INTO public.repair_types (name, description, price, points) VALUES
('Button S3', 'Button vervangen S3', 39.00, 3),
('Remklauw S3', 'Remklauw vervangen S3', 59.00, 3),
('Display', 'Display vervangen', 69.00, 4),
('Naafrevisie', 'Naafrevisie uitvoeren', 79.00, 4),
('Speaker S3', 'Speaker vervangen S3', 79.00, 4),
('Cartridge Batterij', 'Cartridge batterij vervangen', 79.00, 4),
('Remblokjes', 'Remblokjes vervangen', 15.00, 1),
('Remmen ontluchten', 'Remmen ontluchten', 69.00, 4),
('Kicklockdopje', 'Kicklockdopje vervangen', 12.50, 1),
('Kicklock S3', 'Kicklock vervangen S3', 125.00, 5),
('Remhendel S3', 'Remhendel vervangen S3', 129.00, 5),
('Voordrager', 'Voordrager plaatsen', 139.00, 5),
('VW Motor gebruikt', 'Voorwielmotor vervangen (gebruikt)', 139.00, 5),
('VW Motor nieuw', 'Voorwielmotor vervangen (nieuw)', 259.00, 6),
('E-Shifter S3', 'E-Shifter vervangen S3', 199.00, 6),
('Achterwiel S3', 'Achterwiel vervangen S3', 249.00, 6),
('Naaf S3', 'Naaf vervangen S3', 299.00, 7),
('Accu S3', 'Accu vervangen S3', 399.00, 8),
('Cartridge S3', 'Cartridge vervangen S3', 399.00, 8),
('Socket S3', 'Socket vervangen S3', 449.00, 8),
('Socket X3', 'Socket vervangen X3', 549.00, 9),
('Spoofer', 'Spoofer installeren', 50.00, 3),
('Laadpoort S3', 'Laadpoort vervangen S3', 159.00, 5),
('Rekjes voor', 'Rekjes voor plaatsen', 179.00, 5),
('Button en stuuruitslag', 'Button en stuuruitslag reparatie', 149.00, 5);

-- Insert S5 repairs
INSERT INTO public.repair_types (name, description, price, points) VALUES
('Motor Bracket S5', 'Motor bracket vervangen S5', 75.00, 4),
('Kicklock S5', 'Kicklock vervangen S5', 249.00, 6),
('User ECU', 'User ECU vervangen', 249.00, 6),
('E-Shifter S5', 'E-Shifter vervangen S5', 299.00, 7),
('Power ECU', 'Power ECU vervangen', 499.00, 9),
('Main ECU S5', 'Main ECU vervangen S5', 799.00, 10),
('Accu S5', 'Accu vervangen S5', 799.00, 10),
('Voorwiel S5', 'Voorwiel vervangen S5', 499.00, 9);

-- Insert Divers (all models)
INSERT INTO public.repair_types (name, description, price, points) VALUES
('Kettingkast hoek', 'Kettingkast hoek vervangen', 25.00, 2),
('Bagagedrager', 'Bagagedrager plaatsen', 49.99, 3),
('Kettingspanner', 'Kettingspanner vervangen', 39.00, 3),
('Spatbord', 'Spatbord vervangen', 39.00, 3),
('Spatbordhouder', 'Spatbordhouder vervangen', 29.00, 2),
('Voorvork nieuw', 'Voorvork vervangen (nieuw)', 259.00, 6),
('Ketting inkorten', 'Ketting inkorten', 29.00, 2),
('Balhoofdlager', 'Balhoofdlager vervangen', 44.00, 3),
('Buitenband', 'Buitenband vervangen', 59.00, 3),
('Trapas algemeen', 'Trapas vervangen', 99.00, 4),
('Motorkabelklepje', 'Motorkabelklepje vervangen', 25.00, 2),
('Accu klepje', 'Accu klepje vervangen', 25.00, 2),
('Binnen + buitenband', 'Binnen en buitenband vervangen', 69.00, 4),
('Stuuruitslag', 'Stuuruitslag reparatie', 99.00, 4),
('Ketting onderdeel', 'Ketting onderdeel vervangen', 19.00, 2),
('Lamp kapje', 'Lamp kapje vervangen', 12.50, 1),
('Kettingkast kapje', 'Kettingkast kapje vervangen', 25.00, 2),
('Ketting vervangen', 'Ketting vervangen', 59.00, 3),
('Powerbank kabel', 'Powerbank kabel vervangen', 69.00, 4),
('Powerbank', 'Powerbank installeren', 200.00, 6),
('Lader S2', 'Lader S2', 49.00, 3),
('Kettingkast voorkant', 'Kettingkast voorkant vervangen', 39.00, 3),
('Button met kabel', 'Button met kabel vervangen', 59.00, 3),
('Main ECU reparatie', 'Main ECU reparatie', 599.00, 10);

-- Now link repairs to models
-- S1 repairs
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'S1' FROM public.repair_types WHERE name IN ('Trapper gebruikt', 'Scherm', 'Trapas S1', 'Cartridge Accu S1', 'Cartridge S1', 'Motorkabel', 'Accu S1');

-- S2 repairs
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'S2' FROM public.repair_types WHERE name IN ('Klein onderhoud', 'Stuur', 'Remklauw S2', 'Button S2', 'Kicklock S2', 'Laadpoort S2', 'Cartridge S2', 'Socket S2', 'Remhendel S2', 'Remkabel voor', 'Remkabel achter', 'Motorklepje', 'Accuklepje', 'Lamp voor + achter', 'Remschijf', 'Kettingkast compleet', 'Trapas S2', 'Trappers per stuk', 'Achterwiel S2', 'Crank per stuk', 'Balhoofdlager S2', 'Rekjes achter', 'Lader S2');

-- X2 repairs
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'X2' FROM public.repair_types WHERE name IN ('Laadpoort X2', 'Spatbord X2', 'Speaker X2');

-- S3 repairs
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'S3' FROM public.repair_types WHERE name IN ('Button S3', 'Remklauw S3', 'Display', 'Naafrevisie', 'Speaker S3', 'Cartridge Batterij', 'Remblokjes', 'Remmen ontluchten', 'Kicklockdopje', 'Kicklock S3', 'Remhendel S3', 'Voordrager', 'VW Motor gebruikt', 'VW Motor nieuw', 'E-Shifter S3', 'Achterwiel S3', 'Naaf S3', 'Accu S3', 'Cartridge S3', 'Socket S3', 'Spoofer', 'Laadpoort S3', 'Rekjes voor', 'Button en stuuruitslag');

-- X3 repairs  
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'X3' FROM public.repair_types WHERE name IN ('Socket X3', 'Button S3', 'Remklauw S3', 'Display', 'Naafrevisie', 'Speaker S3', 'Cartridge Batterij', 'Remblokjes', 'Remmen ontluchten', 'Kicklockdopje', 'Kicklock S3', 'Remhendel S3', 'VW Motor gebruikt', 'VW Motor nieuw', 'E-Shifter S3', 'Achterwiel S3', 'Naaf S3', 'Accu S3', 'Cartridge S3', 'Spoofer', 'Laadpoort S3');

-- S4 - similar to S3
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'S4' FROM public.repair_types WHERE name IN ('Button S3', 'Remklauw S3', 'Display', 'Naafrevisie', 'Speaker S3', 'Cartridge Batterij', 'Remblokjes', 'Remmen ontluchten', 'Kicklockdopje', 'Kicklock S3', 'Remhendel S3', 'Voordrager', 'VW Motor gebruikt', 'VW Motor nieuw', 'E-Shifter S3', 'Achterwiel S3', 'Naaf S3', 'Accu S3', 'Cartridge S3', 'Socket S3', 'Spoofer', 'Laadpoort S3', 'Rekjes voor', 'Button en stuuruitslag');

-- X4 - similar to X3
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'X4' FROM public.repair_types WHERE name IN ('Socket X3', 'Button S3', 'Remklauw S3', 'Display', 'Naafrevisie', 'Speaker S3', 'Cartridge Batterij', 'Remblokjes', 'Remmen ontluchten', 'Kicklockdopje', 'Kicklock S3', 'Remhendel S3', 'VW Motor gebruikt', 'VW Motor nieuw', 'E-Shifter S3', 'Achterwiel S3', 'Naaf S3', 'Accu S3', 'Cartridge S3', 'Spoofer', 'Laadpoort S3');

-- S5 repairs
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'S5' FROM public.repair_types WHERE name IN ('Motor Bracket S5', 'Kicklock S5', 'User ECU', 'E-Shifter S5', 'Power ECU', 'Main ECU S5', 'Accu S5', 'Voorwiel S5');

-- S6 - similar to S5
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'S6' FROM public.repair_types WHERE name IN ('Motor Bracket S5', 'Kicklock S5', 'User ECU', 'E-Shifter S5', 'Power ECU', 'Main ECU S5', 'Accu S5', 'Voorwiel S5');

-- X5 - similar to S5
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'X5' FROM public.repair_types WHERE name IN ('Motor Bracket S5', 'Kicklock S5', 'User ECU', 'E-Shifter S5', 'Power ECU', 'Main ECU S5', 'Accu S5', 'Voorwiel S5');

-- A5 - similar to S5
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'A5' FROM public.repair_types WHERE name IN ('Motor Bracket S5', 'Kicklock S5', 'User ECU', 'E-Shifter S5', 'Power ECU', 'Main ECU S5', 'Accu S5', 'Voorwiel S5');

-- Divers repairs - for ALL models
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT rt.id, m.model
FROM public.repair_types rt
CROSS JOIN (SELECT unnest(ARRAY['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'X1', 'X2', 'X3', 'X4', 'X5', 'A5']) as model) m
WHERE rt.name IN ('Kettingkast hoek', 'Bagagedrager', 'Kettingspanner', 'Spatbord', 'Spatbordhouder', 'Voorvork nieuw', 'Ketting inkorten', 'Balhoofdlager', 'Buitenband', 'Trapas algemeen', 'Motorkabelklepje', 'Accu klepje', 'Binnen + buitenband', 'Stuuruitslag', 'Ketting onderdeel', 'Lamp kapje', 'Kettingkast kapje', 'Ketting vervangen', 'Powerbank kabel', 'Powerbank', 'Kettingkast voorkant', 'Button met kabel', 'Main ECU reparatie')
ON CONFLICT (repair_type_id, model) DO NOTHING;

-- X1 gets S1/S2 style repairs
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'X1' FROM public.repair_types WHERE name IN ('Trapper gebruikt', 'Scherm', 'Trapas S1', 'Cartridge Accu S1', 'Cartridge S1', 'Motorkabel', 'Accu S1', 'Klein onderhoud', 'Stuur', 'Remhendel S2', 'Remkabel voor', 'Remkabel achter', 'Lamp voor + achter', 'Remschijf', 'Trappers per stuk')
ON CONFLICT (repair_type_id, model) DO NOTHING;

-- Add some X2 repairs that overlap with S2
INSERT INTO public.repair_type_models (repair_type_id, model)
SELECT id, 'X2' FROM public.repair_types WHERE name IN ('Klein onderhoud', 'Stuur', 'Remkabel voor', 'Remkabel achter', 'Lamp voor + achter', 'Remschijf', 'Trappers per stuk', 'Kettingkast compleet')
ON CONFLICT (repair_type_id, model) DO NOTHING;