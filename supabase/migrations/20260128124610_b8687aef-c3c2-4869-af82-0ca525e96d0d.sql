-- Enum voor gebruikersrollen
CREATE TYPE public.app_role AS ENUM ('monteur', 'admin');

-- Enum voor VanMoof modellen
CREATE TYPE public.vanmoof_model AS ENUM ('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'X1', 'X2', 'X3', 'X4', 'X5', 'A5');

-- Enum voor reparatiestatus
CREATE TYPE public.repair_status AS ENUM ('open', 'in_behandeling', 'afgerond');

-- Profielen tabel
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles tabel (gescheiden van profiles voor veiligheid)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'monteur',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Fietsen tabel
CREATE TABLE public.bikes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frame_number TEXT NOT NULL UNIQUE,
    model vanmoof_model NOT NULL,
    status repair_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reparatietypes tabel (met puntensysteem)
CREATE TABLE public.repair_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Werkregistraties tabel
CREATE TABLE public.work_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bike_id UUID REFERENCES public.bikes(id) ON DELETE CASCADE NOT NULL,
    repair_type_id UUID REFERENCES public.repair_types(id) ON DELETE RESTRICT NOT NULL,
    mechanic_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Opmerkingen tabel
CREATE TABLE public.bike_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bike_id UUID REFERENCES public.bikes(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS op alle tabellen
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_comments ENABLE ROW LEVEL SECURITY;

-- Security definer functie voor rol check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies voor profiles
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policies voor user_roles
CREATE POLICY "Users can view their own role"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
    ON public.user_roles FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies voor bikes (iedereen mag lezen/schrijven die ingelogd is)
CREATE POLICY "Authenticated users can view bikes"
    ON public.bikes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert bikes"
    ON public.bikes FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update bikes"
    ON public.bikes FOR UPDATE
    TO authenticated
    USING (true);

-- RLS Policies voor repair_types
CREATE POLICY "Authenticated users can view repair types"
    ON public.repair_types FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage repair types"
    ON public.repair_types FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies voor work_registrations
CREATE POLICY "Authenticated users can view work registrations"
    ON public.work_registrations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert work registrations"
    ON public.work_registrations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Mechanics can update their own registrations"
    ON public.work_registrations FOR UPDATE
    TO authenticated
    USING (auth.uid() = mechanic_id OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies voor bike_comments
CREATE POLICY "Authenticated users can view comments"
    ON public.bike_comments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can add comments"
    ON public.bike_comments FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

-- Trigger voor automatisch profile aanmaken bij registratie
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'monteur');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Standaard reparatietypes invoegen
INSERT INTO public.repair_types (name, description, points) VALUES
    ('Bandvervanging voor', 'Voorband vervangen', 2),
    ('Bandvervanging achter', 'Achterband vervangen', 3),
    ('Remblokken vervangen', 'Remblokken voor en/of achter vervangen', 2),
    ('Ketting vervangen', 'Ketting vervangen en afstellen', 3),
    ('Elektronica diagnose', 'Diagnose van elektrische problemen', 4),
    ('Motor reparatie', 'Reparatie of vervanging van de motor', 8),
    ('Accu vervanging', 'Accu vervangen', 5),
    ('Software update', 'Firmware/software update uitvoeren', 2),
    ('Slot reparatie', 'Reparatie van het geïntegreerde slot', 4),
    ('Frame inspectie', 'Volledige frame inspectie', 3),
    ('Stuur/cockpit reparatie', 'Reparatie van stuur of cockpit unit', 5),
    ('Versnelling afstellen', 'Versnellingssysteem afstellen', 2),
    ('Lager vervangen', 'Lagers vervangen (trapas, stuur, wiel)', 4),
    ('Spaken vervangen', 'Spaken vervangen en wiel richten', 3),
    ('Complete servicebeurt', 'Volledige servicebeurt', 10);

-- Trigger voor updated_at kolommen
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bikes_updated_at
    BEFORE UPDATE ON public.bikes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();