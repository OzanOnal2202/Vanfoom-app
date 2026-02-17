-- Allow FOH users to delete their own call history entries
CREATE POLICY "Users can delete their own call history"
ON public.bike_call_history
FOR DELETE
USING (auth.uid() = called_by);