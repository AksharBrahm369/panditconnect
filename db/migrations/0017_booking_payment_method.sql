ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'NOT_SELECTED',
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('CASH','UPI','CARD','OTHER'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_payment_status_check
    CHECK (payment_status IN ('NOT_SELECTED','CONFIRMED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
