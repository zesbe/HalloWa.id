-- Add custom variables, birthday, and reminders to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS var1 TEXT,
ADD COLUMN IF NOT EXISTS var2 TEXT,
ADD COLUMN IF NOT EXISTS var3 TEXT,
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contacts.var1 IS 'Custom variable 1 for personalized messages';
COMMENT ON COLUMN public.contacts.var2 IS 'Custom variable 2 for personalized messages';
COMMENT ON COLUMN public.contacts.var3 IS 'Custom variable 3 for personalized messages';
COMMENT ON COLUMN public.contacts.birthday IS 'Contact birthday for automatic reminders';
COMMENT ON COLUMN public.contacts.reminders IS 'Array of reminder objects with date, type, and message';