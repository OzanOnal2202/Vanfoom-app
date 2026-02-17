-- Add is_sales_bike column to bikes table
ALTER TABLE public.bikes ADD COLUMN is_sales_bike boolean NOT NULL DEFAULT false;