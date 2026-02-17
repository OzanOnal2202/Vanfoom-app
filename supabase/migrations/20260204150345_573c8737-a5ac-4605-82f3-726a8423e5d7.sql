-- Allow anonymous users to search bikes by frame number for the public status page
CREATE POLICY "Public can view bikes by frame number"
ON public.bikes
FOR SELECT
TO anon
USING (true);