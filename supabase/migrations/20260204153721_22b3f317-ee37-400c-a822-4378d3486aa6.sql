-- Add rejection support to foh_tasks table
ALTER TABLE public.foh_tasks 
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Update RLS policies to be more restrictive:
-- Users can only see tasks they created OR tasks assigned to them

-- First drop all existing policies for foh_tasks
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.foh_tasks;
DROP POLICY IF EXISTS "FOH and Admins can insert tasks" ON public.foh_tasks;
DROP POLICY IF EXISTS "FOH and Admins can update tasks" ON public.foh_tasks;
DROP POLICY IF EXISTS "FOH and Admins can view tasks" ON public.foh_tasks;
DROP POLICY IF EXISTS "FOH can delete their own tasks" ON public.foh_tasks;
DROP POLICY IF EXISTS "Users can view tasks assigned to them" ON public.foh_tasks;

-- New SELECT policy: users can see tasks they created OR are assigned to them
CREATE POLICY "Users can view relevant tasks"
ON public.foh_tasks FOR SELECT
USING (
  auth.uid() = created_by 
  OR auth.uid() = assigned_to
);

-- INSERT policy: authenticated users can create tasks
CREATE POLICY "Authenticated users can create tasks"
ON public.foh_tasks FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- UPDATE policy: users can update their own tasks or tasks assigned to them
CREATE POLICY "Users can update relevant tasks"
ON public.foh_tasks FOR UPDATE
USING (
  auth.uid() = created_by 
  OR auth.uid() = assigned_to
);

-- DELETE policy: users can delete tasks they created (not yet started)
CREATE POLICY "Users can delete their own tasks"
ON public.foh_tasks FOR DELETE
USING (auth.uid() = created_by);