-- Create communication_logs table for tracking all communications
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT,
  recipient_phone TEXT,
  type TEXT NOT NULL CHECK (type IN ('email', 'notification', 'sms', 'whatsapp')),
  subject TEXT,
  content TEXT NOT NULL,
  template_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_templates table
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'notification', 'sms', 'whatsapp')),
  subject TEXT,
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for communication_logs
CREATE POLICY "Admins can view all logs"
  ON public.communication_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ));

CREATE POLICY "Service can insert logs"
  ON public.communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update logs"
  ON public.communication_logs FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for notification_templates
CREATE POLICY "Admins can manage templates"
  ON public.notification_templates FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ));

-- Create indexes
CREATE INDEX idx_communication_logs_user_id ON public.communication_logs(user_id);
CREATE INDEX idx_communication_logs_type ON public.communication_logs(type);
CREATE INDEX idx_communication_logs_status ON public.communication_logs(status);
CREATE INDEX idx_communication_logs_sent_at ON public.communication_logs(sent_at);
CREATE INDEX idx_notification_templates_status ON public.notification_templates(status);

-- Create trigger for updated_at
CREATE TRIGGER update_communication_logs_updated_at
  BEFORE UPDATE ON public.communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();