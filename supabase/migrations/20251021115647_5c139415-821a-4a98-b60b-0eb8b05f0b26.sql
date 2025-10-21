-- Add delay settings and safety features to broadcasts table
ALTER TABLE public.broadcasts 
ADD COLUMN IF NOT EXISTS delay_seconds INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS delay_type TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS randomize_delay BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS pause_between_batches INTEGER DEFAULT 60;

-- Add comment for documentation
COMMENT ON COLUMN public.broadcasts.delay_seconds IS 'Delay between messages in seconds (min 2, max 60)';
COMMENT ON COLUMN public.broadcasts.delay_type IS 'auto, manual, or adaptive';
COMMENT ON COLUMN public.broadcasts.randomize_delay IS 'Add random variation to delay (±30%)';
COMMENT ON COLUMN public.broadcasts.batch_size IS 'Number of messages per batch before pause';
COMMENT ON COLUMN public.broadcasts.pause_between_batches IS 'Pause duration between batches in seconds';