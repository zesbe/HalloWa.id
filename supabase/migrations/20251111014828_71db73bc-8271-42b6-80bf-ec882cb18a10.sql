-- Enable realtime for audit_logs table
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

-- Add audit_logs to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

-- Enable realtime for communication_logs table
ALTER TABLE public.communication_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;

-- Enable realtime for notification_templates table  
ALTER TABLE public.notification_templates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_templates;

-- Enable realtime for system_alerts table
ALTER TABLE public.system_alerts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_alerts;