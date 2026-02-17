-- Create FOH tasks table
CREATE TABLE public.foh_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_number SERIAL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'nog_niet_gestart' CHECK (status IN ('nog_niet_gestart', 'in_behandeling', 'afgerond')),
    assigned_to UUID REFERENCES public.profiles(id),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    deadline DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.foh_tasks ENABLE ROW LEVEL SECURITY;

-- FOH and Admins can view all tasks
CREATE POLICY "FOH and Admins can view tasks"
ON public.foh_tasks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'foh'::app_role));

-- FOH and Admins can insert tasks
CREATE POLICY "FOH and Admins can insert tasks"
ON public.foh_tasks
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'foh'::app_role));

-- FOH and Admins can update tasks
CREATE POLICY "FOH and Admins can update tasks"
ON public.foh_tasks
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'foh'::app_role));

-- Admins can delete tasks
CREATE POLICY "Admins can delete tasks"
ON public.foh_tasks
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_foh_tasks_updated_at
BEFORE UPDATE ON public.foh_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.foh_tasks;