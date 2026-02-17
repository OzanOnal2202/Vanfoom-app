
-- Create a helper function to check user permissions (like has_role but for feature permissions)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
  )
$$;

-- Allow users with 'inventory' permission to delete from inventory
CREATE POLICY "Users with inventory permission can delete inventory"
ON public.inventory
FOR DELETE
USING (has_permission(auth.uid(), 'inventory'));

-- Allow users with 'inventory' permission to update inventory
CREATE POLICY "Users with inventory permission can update inventory"
ON public.inventory
FOR UPDATE
USING (has_permission(auth.uid(), 'inventory'));

-- Allow users with 'inventory' permission to manage inventory_groups
CREATE POLICY "Users with inventory permission can update groups"
ON public.inventory_groups
FOR UPDATE
USING (has_permission(auth.uid(), 'inventory'));

CREATE POLICY "Users with inventory permission can insert groups"
ON public.inventory_groups
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'inventory'));

CREATE POLICY "Users with inventory permission can delete groups"
ON public.inventory_groups
FOR DELETE
USING (has_permission(auth.uid(), 'inventory'));

-- Allow users with 'inventory' permission to manage repair_types (for delete cascade)
CREATE POLICY "Users with inventory permission can delete repair types"
ON public.repair_types
FOR DELETE
USING (has_permission(auth.uid(), 'inventory'));

CREATE POLICY "Users with inventory permission can insert repair types"
ON public.repair_types
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'inventory'));

-- Allow users with 'inventory' permission to delete work_registrations (for cascade)
CREATE POLICY "Users with inventory permission can delete work registrations"
ON public.work_registrations
FOR DELETE
USING (has_permission(auth.uid(), 'inventory'));

-- Allow users with 'inventory' permission to delete repair_type_models (for cascade)
CREATE POLICY "Users with inventory permission can delete repair type models"
ON public.repair_type_models
FOR DELETE
USING (has_permission(auth.uid(), 'inventory'));
