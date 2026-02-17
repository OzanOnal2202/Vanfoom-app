-- Add is_approved column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_approved boolean NOT NULL DEFAULT false;

-- Set existing profiles to approved (they were already in the system)
UPDATE public.profiles SET is_approved = true;

-- Create index for faster queries on pending approvals
CREATE INDEX idx_profiles_pending_approval ON public.profiles (is_approved) WHERE is_approved = false;