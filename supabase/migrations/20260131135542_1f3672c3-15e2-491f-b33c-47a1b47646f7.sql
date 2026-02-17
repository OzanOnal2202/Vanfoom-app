-- Create table for TV announcements
CREATE TABLE public.tv_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.tv_announcements ENABLE ROW LEVEL SECURITY;

-- Only admins can manage announcements
CREATE POLICY "Admins can manage announcements"
  ON public.tv_announcements
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view active announcements (for TV display)
CREATE POLICY "Anyone can view active announcements"
  ON public.tv_announcements
  FOR SELECT
  USING (is_active = true);