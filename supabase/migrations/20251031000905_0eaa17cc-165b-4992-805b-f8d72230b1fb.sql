-- Create table for auto post schedules to WhatsApp groups
CREATE TABLE public.auto_post_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id UUID NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  target_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequency TEXT NOT NULL DEFAULT 'daily',
  schedule_time TIME NOT NULL,
  schedule_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7],
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  next_send_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_frequency CHECK (frequency IN ('daily', 'weekly', 'monthly'))
);

-- Enable RLS
ALTER TABLE public.auto_post_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own schedules" 
ON public.auto_post_schedules 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules" 
ON public.auto_post_schedules 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules" 
ON public.auto_post_schedules 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules" 
ON public.auto_post_schedules 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_auto_post_schedules_updated_at
BEFORE UPDATE ON public.auto_post_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();