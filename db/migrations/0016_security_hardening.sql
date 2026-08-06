ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS arrival_otp_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS otp_challenge_active_lookup_idx
  ON pim_v2.otp_challenges(phone, role, created_at DESC)
  WHERE verified_at IS NULL;
