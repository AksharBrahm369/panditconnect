ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE INDEX IF NOT EXISTS booking_scheduled_at_idx
  ON pim_v2.bookings(scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status NOT IN ('COMPLETED','CANCELLED','DECLINED');

