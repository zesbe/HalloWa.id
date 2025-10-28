-- Make device_id nullable for manual contact entry
ALTER TABLE public.contacts
ALTER COLUMN device_id DROP NOT NULL;

-- Add comment explaining the nullable device_id
COMMENT ON COLUMN public.contacts.device_id IS 'Device ID for synced contacts, nullable for manually added contacts';