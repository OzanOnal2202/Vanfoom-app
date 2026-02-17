-- Allow admins to delete bikes
CREATE POLICY "Admins can delete bikes" 
ON public.bikes 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));