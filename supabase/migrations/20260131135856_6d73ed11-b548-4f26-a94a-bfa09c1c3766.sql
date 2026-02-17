-- Add styling columns to tv_announcements
ALTER TABLE public.tv_announcements
ADD COLUMN background_color TEXT DEFAULT 'blue-cyan',
ADD COLUMN text_color TEXT DEFAULT 'white',
ADD COLUMN icon TEXT DEFAULT '📢';