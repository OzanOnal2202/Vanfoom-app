-- Add new profile fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS job_function TEXT,
ADD COLUMN IF NOT EXISTS contract TEXT;