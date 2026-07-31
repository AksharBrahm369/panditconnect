ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS declined_pandit_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];
