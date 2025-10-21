-- Add new columns to devices table for advanced features
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS server_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_url TEXT,
ADD COLUMN IF NOT EXISTS is_multidevice BOOLEAN DEFAULT true;

-- Create index for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(api_key);

-- Function to generate random API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate API key on device creation
CREATE OR REPLACE FUNCTION auto_generate_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.api_key IS NULL THEN
    NEW.api_key := generate_api_key();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_api_key
BEFORE INSERT ON devices
FOR EACH ROW
EXECUTE FUNCTION auto_generate_api_key();

-- Enable realtime for devices table
ALTER TABLE devices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE devices;