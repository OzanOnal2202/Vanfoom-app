
-- Allow users with 'inventory' permission to update repair types (for editing properties)
CREATE POLICY "Users with inventory permission can update repair types"
ON public.repair_types
FOR UPDATE
USING (has_permission(auth.uid(), 'inventory'));
