-- Update call statuses: remove "Opnieuw bellen" and rename "Klant bereikt" to "Akkoord ontvangen"

-- Deactivate "Opnieuw bellen" status
UPDATE public.table_call_statuses 
SET is_active = false 
WHERE name = 'Opnieuw bellen';

-- Rename "Klant bereikt" to "Akkoord ontvangen" / "Approval received"
UPDATE public.table_call_statuses 
SET name = 'Akkoord ontvangen', name_en = 'Approval received'
WHERE name = 'Klant bereikt';

-- Update sort order for remaining statuses
UPDATE public.table_call_statuses SET sort_order = 1 WHERE name = 'Moet gebeld worden';
UPDATE public.table_call_statuses SET sort_order = 2 WHERE name = 'Gebeld - wacht op reactie';
UPDATE public.table_call_statuses SET sort_order = 3 WHERE name = 'Akkoord ontvangen';