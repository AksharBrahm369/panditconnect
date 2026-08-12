-- Google OpenID Connect identities use Google's stable `sub` claim.
-- A Google account does not disclose a mobile number, so phone becomes optional.
ALTER TABLE pim_v2.users
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS google_subject text,
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'PHONE';

ALTER TABLE pim_v2.users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
ALTER TABLE pim_v2.users ADD CONSTRAINT users_auth_provider_check
  CHECK (auth_provider IN ('PHONE','GOOGLE'));

ALTER TABLE pim_v2.users DROP CONSTRAINT IF EXISTS users_login_identity_check;
ALTER TABLE pim_v2.users ADD CONSTRAINT users_login_identity_check
  CHECK (phone IS NOT NULL OR google_subject IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique_idx
  ON pim_v2.users(google_subject)
  WHERE google_subject IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_email_unique_idx
  ON pim_v2.users(lower(email))
  WHERE google_subject IS NOT NULL AND email IS NOT NULL;
