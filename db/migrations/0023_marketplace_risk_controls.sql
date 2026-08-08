ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS policy_version text,
  ADD COLUMN IF NOT EXISTS policy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS policy_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS policy_ip_hash text,
  ADD COLUMN IF NOT EXISTS policy_device_hash text,
  ADD COLUMN IF NOT EXISTS client_request_id uuid,
  ADD COLUMN IF NOT EXISTS cancellation_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_fee_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS travel_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS travel_started_latitude double precision,
  ADD COLUMN IF NOT EXISTS travel_started_longitude double precision,
  ADD COLUMN IF NOT EXISTS arrival_distance_metres integer,
  ADD COLUMN IF NOT EXISTS customer_cash_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pandit_cash_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_disputed_at timestamptz;
ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS proposed_amount integer,
  ADD COLUMN IF NOT EXISTS price_change_reason text,
  ADD COLUMN IF NOT EXISTS price_change_status text NOT NULL DEFAULT 'NONE';
DO $$ BEGIN ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_price_change_status_check CHECK (price_change_status IN ('NONE','PENDING','APPROVED','REJECTED')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_proposed_amount_positive CHECK (proposed_amount IS NULL OR proposed_amount > 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_cancellation_fee_nonnegative CHECK (cancellation_fee >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_cancellation_fee_status_check CHECK (cancellation_fee_status IN ('NONE','OUTSTANDING','PAID','WAIVED','DISPUTED')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE pim_v2.bookings DROP CONSTRAINT IF EXISTS booking_payment_status_check;
ALTER TABLE pim_v2.bookings ADD CONSTRAINT booking_payment_status_check CHECK (payment_status IN ('NOT_SELECTED','AWAITING_PANDIT','CONFIRMED','DISPUTED'));

CREATE TABLE IF NOT EXISTS pim_v2.customer_risk_profiles (
  user_id uuid PRIMARY KEY REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  risk_points integer NOT NULL DEFAULT 0 CHECK (risk_points >= 0),
  late_cancellations integer NOT NULL DEFAULT 0 CHECK (late_cancellations >= 0),
  no_shows integer NOT NULL DEFAULT 0 CHECK (no_shows >= 0),
  payment_disputes integer NOT NULL DEFAULT 0 CHECK (payment_disputes >= 0),
  requires_prepayment boolean NOT NULL DEFAULT false,
  restricted_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pim_v2.account_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES pim_v2.bookings(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('CANCELLATION_FEE','CANCELLATION_PAYMENT','FEE_WAIVER','PANDIT_COMPENSATION')),
  amount integer NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'OUTSTANDING' CHECK (status IN ('OUTSTANDING','PAID','WAIVED','DISPUTED','PENDING')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS ledger_user_status_idx ON pim_v2.account_ledger(user_id,status,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_cancellation_fee_idx ON pim_v2.account_ledger(booking_id,entry_type) WHERE entry_type='CANCELLATION_FEE';

CREATE TABLE IF NOT EXISTS pim_v2.booking_events (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES pim_v2.bookings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  actor_role text,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_timeline_idx ON pim_v2.booking_events(booking_id,created_at);

CREATE UNIQUE INDEX IF NOT EXISTS booking_customer_request_key_idx ON pim_v2.bookings(customer_id,client_request_id) WHERE client_request_id IS NOT NULL;

-- Friendly overlap validation lives in the API. This lock-backed trigger is the
-- final concurrency guard when two tabs submit at exactly the same time.
CREATE OR REPLACE FUNCTION pim_v2.prevent_customer_booking_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS') THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.customer_id::text));
    IF EXISTS (
      SELECT 1 FROM pim_v2.bookings existing
      WHERE existing.customer_id=NEW.customer_id
        AND existing.id<>NEW.id
        AND existing.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
        AND (
          NEW.scheduled_at IS NULL OR existing.scheduled_at IS NULL OR
          existing.scheduled_at BETWEEN NEW.scheduled_at-interval '3 hours' AND NEW.scheduled_at+interval '3 hours'
        )
    ) THEN
      RAISE EXCEPTION 'customer already has an active or overlapping booking' USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS prevent_customer_booking_overlap_trigger ON pim_v2.bookings;
CREATE TRIGGER prevent_customer_booking_overlap_trigger
BEFORE INSERT ON pim_v2.bookings
FOR EACH ROW EXECUTE FUNCTION pim_v2.prevent_customer_booking_overlap();
