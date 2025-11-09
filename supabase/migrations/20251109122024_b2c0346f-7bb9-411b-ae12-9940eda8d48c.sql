-- Add duration_months column to plans table
ALTER TABLE public.plans 
ADD COLUMN duration_months integer NOT NULL DEFAULT 1;

-- Update existing plans with proper durations (assuming standard plans)
-- You can adjust these based on your actual plan names
UPDATE public.plans 
SET duration_months = 1 
WHERE name ILIKE '%1 bulan%' OR name ILIKE '%monthly%' OR name ILIKE '%bulanan%';

UPDATE public.plans 
SET duration_months = 6 
WHERE name ILIKE '%6 bulan%' OR name ILIKE '%semester%' OR name ILIKE '%6 month%';

UPDATE public.plans 
SET duration_months = 12 
WHERE name ILIKE '%1 tahun%' OR name ILIKE '%yearly%' OR name ILIKE '%tahunan%' OR name ILIKE '%annual%';