-- Backfill emails for existing users from auth.users to profiles
UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND (profiles.email IS NULL OR profiles.email = '');