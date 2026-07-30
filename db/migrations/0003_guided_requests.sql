ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'KNOWN_PUJA',
  ADD COLUMN IF NOT EXISTS situation text,
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS materials_option text NOT NULL DEFAULT 'NEED_GUIDANCE';

CREATE INDEX IF NOT EXISTS booking_status_created_idx
  ON pim_v2.bookings(status, created_at DESC);
