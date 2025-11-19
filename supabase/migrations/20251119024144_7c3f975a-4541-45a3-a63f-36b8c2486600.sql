-- Fix load balancing: Count all assigned devices, not just connected ones
-- This ensures max_capacity works correctly even during device assignment

-- Drop existing trigger first
DROP TRIGGER IF EXISTS update_server_load_trigger ON public.devices;

-- Update the function to count ALL assigned devices (not just connected)
CREATE OR REPLACE FUNCTION public.update_server_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update current load when device is assigned (count ALL assigned, not just connected)
    IF NEW.assigned_server_id IS NOT NULL THEN
      UPDATE public.backend_servers
      SET 
        current_load = (
          SELECT COUNT(*) 
          FROM public.devices 
          WHERE assigned_server_id = NEW.assigned_server_id
            AND assigned_server_id IS NOT NULL  -- Count all assigned devices
        ),
        updated_at = NOW()
      WHERE id = NEW.assigned_server_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    -- Update current load when device is removed or reassigned
    IF OLD.assigned_server_id IS NOT NULL THEN
      UPDATE public.backend_servers
      SET 
        current_load = (
          SELECT COUNT(*) 
          FROM public.devices 
          WHERE assigned_server_id = OLD.assigned_server_id
            AND assigned_server_id IS NOT NULL  -- Count all assigned devices
        ),
        updated_at = NOW()
      WHERE id = OLD.assigned_server_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_server_load_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_server_load();

-- Update current_load for all servers based on assigned devices
UPDATE public.backend_servers bs
SET current_load = (
  SELECT COUNT(*) 
  FROM public.devices d
  WHERE d.assigned_server_id = bs.id
    AND d.assigned_server_id IS NOT NULL
),
updated_at = NOW();