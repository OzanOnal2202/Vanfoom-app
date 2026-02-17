-- Add fullscreen/priority mode to tv_announcements
ALTER TABLE public.tv_announcements
ADD COLUMN is_fullscreen BOOLEAN NOT NULL DEFAULT false;