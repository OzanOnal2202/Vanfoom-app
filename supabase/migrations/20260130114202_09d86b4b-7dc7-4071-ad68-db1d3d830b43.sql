-- Create enum for availability status
CREATE TYPE public.availability_status AS ENUM ('pending', 'approved', 'rejected');

-- Create availability table
CREATE TABLE public.mechanic_availability (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status availability_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.mechanic_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Mechanics can view their own availability
CREATE POLICY "Users can view their own availability"
ON public.mechanic_availability
FOR SELECT
USING (auth.uid() = user_id);

-- Mechanics can insert their own availability
CREATE POLICY "Users can insert their own availability"
ON public.mechanic_availability
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Mechanics can update their own pending availability
CREATE POLICY "Users can update their own pending availability"
ON public.mechanic_availability
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Mechanics can delete their own pending availability
CREATE POLICY "Users can delete their own pending availability"
ON public.mechanic_availability
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all availability
CREATE POLICY "Admins can view all availability"
ON public.mechanic_availability
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all availability (for approval)
CREATE POLICY "Admins can update all availability"
ON public.mechanic_availability
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_mechanic_availability_updated_at
BEFORE UPDATE ON public.mechanic_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();