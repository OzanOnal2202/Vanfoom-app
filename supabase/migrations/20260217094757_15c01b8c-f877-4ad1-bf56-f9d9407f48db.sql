
-- Allow users with inventory permission to insert repair type models
CREATE POLICY "Users with inventory permission can insert repair type models"
ON public.repair_type_models
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'inventory'));

-- Allow users with inventory permission to update repair type models
CREATE POLICY "Users with inventory permission can update repair type models"
ON public.repair_type_models
FOR UPDATE
USING (has_permission(auth.uid(), 'inventory'));
