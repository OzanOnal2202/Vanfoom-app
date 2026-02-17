-- Allow FOH users to delete tasks they created
CREATE POLICY "FOH can delete their own tasks"
ON public.foh_tasks
FOR DELETE
USING (has_role(auth.uid(), 'foh'::app_role) AND auth.uid() = created_by);