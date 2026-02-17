-- Create table for checklist template items
CREATE TABLE public.completion_checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track checklist completions per bike
CREATE TABLE public.bike_checklist_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES public.completion_checklist_items(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES public.profiles(id),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(bike_id, checklist_item_id)
);

-- Enable RLS
ALTER TABLE public.completion_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_checklist_completions ENABLE ROW LEVEL SECURITY;

-- Policies for checklist items (viewable by all, manageable by admins)
CREATE POLICY "Authenticated users can view checklist items"
  ON public.completion_checklist_items
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage checklist items"
  ON public.completion_checklist_items
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Policies for bike checklist completions
CREATE POLICY "Authenticated users can view checklist completions"
  ON public.bike_checklist_completions
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert checklist completions"
  ON public.bike_checklist_completions
  FOR INSERT
  WITH CHECK (auth.uid() = completed_by);

CREATE POLICY "Authenticated users can delete their own completions"
  ON public.bike_checklist_completions
  FOR DELETE
  USING (auth.uid() = completed_by);

-- Insert example checklist items
INSERT INTO public.completion_checklist_items (name, description, sort_order) VALUES
  ('Proefrit gemaakt', 'Controleer of de fiets goed rijdt tijdens een korte proefrit', 1),
  ('Remmen getest', 'Test de voor- en achterrem op goede werking', 2),
  ('Verlichting gecontroleerd', 'Controleer of voor- en achterlicht werken', 3),
  ('Display werkt correct', 'Controleer of het display alle informatie correct weergeeft', 4),
  ('Fiets schoongemaakt', 'Maak de fiets schoon voor aflevering aan klant', 5),
  ('Foto gemaakt', 'Maak een foto van de afgeronde fiets voor administratie', 6);