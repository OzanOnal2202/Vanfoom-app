-- Ensure bikes.current_mechanic_id exists
ALTER TABLE public.bikes
ADD COLUMN IF NOT EXISTS current_mechanic_id uuid;

-- Ensure FK constraint exists (needed for PostgREST relationship + integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bikes_current_mechanic_id_fkey'
  ) THEN
    ALTER TABLE public.bikes
      ADD CONSTRAINT bikes_current_mechanic_id_fkey
      FOREIGN KEY (current_mechanic_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;