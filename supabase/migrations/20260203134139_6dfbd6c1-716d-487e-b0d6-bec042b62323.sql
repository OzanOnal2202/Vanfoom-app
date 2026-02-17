-- Allow users to view FOH tasks that are assigned to them
CREATE POLICY "Users can view tasks assigned to them"
ON public.foh_tasks
FOR SELECT
USING (auth.uid() = assigned_to);