-- Create backend_servers table for multi-server management
CREATE TABLE IF NOT EXISTS public.backend_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  server_type TEXT NOT NULL DEFAULT 'vps', -- 'railway', 'vps', 'cloud', etc
  region TEXT,
  max_capacity INTEGER DEFAULT 50, -- max devices per server
  current_load INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_healthy BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- higher priority = preferred server
  api_key TEXT,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_check_failures INTEGER DEFAULT 0,
  response_time INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for active servers
CREATE INDEX idx_backend_servers_active ON public.backend_servers(is_active, is_healthy);
CREATE INDEX idx_backend_servers_priority ON public.backend_servers(priority DESC, current_load ASC);

-- Enable RLS
ALTER TABLE public.backend_servers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for backend_servers
CREATE POLICY "Admins can manage all backend servers"
  ON public.backend_servers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create server_logs table for monitoring
CREATE TABLE IF NOT EXISTS public.server_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id UUID REFERENCES public.backend_servers(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL, -- 'health_check', 'error', 'warning', 'info'
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for server logs
CREATE INDEX idx_server_logs_server_id ON public.server_logs(server_id, created_at DESC);
CREATE INDEX idx_server_logs_type ON public.server_logs(log_type, created_at DESC);

-- Enable RLS for server_logs
ALTER TABLE public.server_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for server_logs
CREATE POLICY "Admins can view all server logs"
  ON public.server_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Service can insert server logs"
  ON public.server_logs
  FOR INSERT
  WITH CHECK (true);

-- Modify devices table to support server allocation
ALTER TABLE public.devices 
  ADD COLUMN IF NOT EXISTS assigned_server_id UUID REFERENCES public.backend_servers(id) ON DELETE SET NULL;

-- Add index for device-server relationship
CREATE INDEX IF NOT EXISTS idx_devices_server ON public.devices(assigned_server_id);

-- Create function to get best available server (load balancing)
CREATE OR REPLACE FUNCTION public.get_best_available_server()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_server_id UUID;
BEGIN
  -- Select server with lowest load, highest priority, and is healthy
  SELECT id INTO v_server_id
  FROM public.backend_servers
  WHERE is_active = true 
    AND is_healthy = true
    AND current_load < max_capacity
  ORDER BY 
    priority DESC,
    (current_load::float / NULLIF(max_capacity, 0)) ASC,
    response_time ASC
  LIMIT 1;
  
  RETURN v_server_id;
END;
$$;

-- Create function to update server load
CREATE OR REPLACE FUNCTION public.update_server_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update current load when device is assigned
    IF NEW.assigned_server_id IS NOT NULL AND NEW.status = 'connected' THEN
      UPDATE public.backend_servers
      SET 
        current_load = (
          SELECT COUNT(*) 
          FROM public.devices 
          WHERE assigned_server_id = NEW.assigned_server_id 
            AND status = 'connected'
        ),
        updated_at = NOW()
      WHERE id = NEW.assigned_server_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    -- Update current load when device is removed or status changed
    IF OLD.assigned_server_id IS NOT NULL THEN
      UPDATE public.backend_servers
      SET 
        current_load = (
          SELECT COUNT(*) 
          FROM public.devices 
          WHERE assigned_server_id = OLD.assigned_server_id 
            AND status = 'connected'
        ),
        updated_at = NOW()
      WHERE id = OLD.assigned_server_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for auto server load update
DROP TRIGGER IF EXISTS trigger_update_server_load ON public.devices;
CREATE TRIGGER trigger_update_server_load
  AFTER INSERT OR UPDATE OR DELETE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_server_load();

-- Create function to reassign devices on server failure
CREATE OR REPLACE FUNCTION public.reassign_devices_on_server_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_server_id UUID;
BEGIN
  -- If server becomes unhealthy or inactive
  IF (NEW.is_healthy = false OR NEW.is_active = false) 
     AND (OLD.is_healthy = true OR OLD.is_active = true) THEN
    
    -- Get best available server for each device
    FOR v_new_server_id IN 
      SELECT DISTINCT get_best_available_server()
      FROM public.devices 
      WHERE assigned_server_id = NEW.id
    LOOP
      -- Reassign devices to new server
      UPDATE public.devices
      SET 
        assigned_server_id = v_new_server_id,
        status = 'disconnected',
        updated_at = NOW()
      WHERE assigned_server_id = NEW.id;
      
      -- Log the reassignment
      INSERT INTO public.server_logs (server_id, log_type, message, details)
      VALUES (
        NEW.id,
        'warning',
        'Devices reassigned due to server failure',
        jsonb_build_object(
          'from_server', NEW.id,
          'to_server', v_new_server_id,
          'reason', CASE 
            WHEN NEW.is_healthy = false THEN 'unhealthy'
            WHEN NEW.is_active = false THEN 'inactive'
          END
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto device reassignment
DROP TRIGGER IF EXISTS trigger_reassign_on_failure ON public.backend_servers;
CREATE TRIGGER trigger_reassign_on_failure
  AFTER UPDATE ON public.backend_servers
  FOR EACH ROW
  WHEN (NEW.is_healthy = false OR NEW.is_active = false)
  EXECUTE FUNCTION public.reassign_devices_on_server_failure();

-- Insert default servers (Railway and example VPS)
INSERT INTO public.backend_servers (server_name, server_url, server_type, region, max_capacity, priority, is_active)
VALUES 
  ('Railway Production', 'https://multi-wa-mate-production.up.railway.app', 'railway', 'Global', 100, 10, true),
  ('VPS Server 1', 'http://168.xxx.xxx.xxx:3000', 'vps', 'ID', 50, 5, false)
ON CONFLICT DO NOTHING;

-- Create function to check server health
CREATE OR REPLACE FUNCTION public.check_server_health(p_server_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_server RECORD;
BEGIN
  SELECT * INTO v_server
  FROM public.backend_servers
  WHERE id = p_server_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Server not found');
  END IF;
  
  -- This will be called from edge function to actually check health
  -- For now, just return server info
  v_result := jsonb_build_object(
    'server_id', v_server.id,
    'server_name', v_server.server_name,
    'server_url', v_server.server_url,
    'is_active', v_server.is_active,
    'is_healthy', v_server.is_healthy,
    'current_load', v_server.current_load,
    'max_capacity', v_server.max_capacity,
    'response_time', v_server.response_time
  );
  
  RETURN v_result;
END;
$$;