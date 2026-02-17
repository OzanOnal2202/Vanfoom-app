-- Add purchase_price column to inventory table
ALTER TABLE public.inventory 
ADD COLUMN purchase_price numeric DEFAULT 0.00;