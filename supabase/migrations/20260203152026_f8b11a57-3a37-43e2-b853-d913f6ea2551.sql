-- Confirm email for markemielmonster@hotmail.com
UPDATE auth.users 
SET email_confirmed_at = now()
WHERE email = 'markemielmonster@hotmail.com' AND email_confirmed_at IS NULL;