ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS dispatch_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS search_radius_km integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_search_radius_km integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_surcharge integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_expansion_at timestamptz;

DO $$ BEGIN
  ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_dispatch_status_check
    CHECK (dispatch_status IN ('NONE','SEARCHING','ASSIGNED','EXHAUSTED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pim_v2.booking_offers (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES pim_v2.bookings(id) ON DELETE CASCADE,
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  radius_km integer NOT NULL,
  distance_km numeric(6,1) NOT NULL,
  service_amount integer NOT NULL,
  travel_surcharge integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OFFERED' CHECK (status IN ('OFFERED','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  UNIQUE (booking_id,pandit_id)
);

CREATE INDEX IF NOT EXISTS booking_offer_pandit_active_idx
  ON pim_v2.booking_offers(pandit_id,expires_at)
  WHERE status='OFFERED';

CREATE INDEX IF NOT EXISTS booking_dispatch_due_idx
  ON pim_v2.bookings(next_expansion_at)
  WHERE status='REQUESTED' AND dispatch_status='SEARCHING';
