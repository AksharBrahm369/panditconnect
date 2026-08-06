-- Free-development OTP security foundation. No SMS provider is configured here.
ALTER TABLE pim_v2.otp_challenges
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='otp_delivery_status_check'
      AND conrelid='pim_v2.otp_challenges'::regclass
  ) THEN
    ALTER TABLE pim_v2.otp_challenges
      ADD CONSTRAINT otp_delivery_status_check
      CHECK (delivery_status IN ('PENDING','DEVELOPMENT','SENT','FAILED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS otp_created_idx
  ON pim_v2.otp_challenges(created_at DESC);

