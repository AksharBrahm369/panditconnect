ALTER TABLE pim_v2.users ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'ACTIVE';
DO $$ BEGIN ALTER TABLE pim_v2.users ADD CONSTRAINT user_account_status_check CHECK (account_status IN ('ACTIVE','SUSPENDED')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES pim_v2.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE TABLE IF NOT EXISTS pim_v2.support_cases (
  id uuid PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES pim_v2.bookings(id) ON DELETE SET NULL,
  consultation_id uuid REFERENCES pim_v2.consultations(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('NO_SHOW','SAFETY','SERVICE_QUALITY','BOOKING','CHAT','ACCOUNT','OTHER')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL','URGENT')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','RESOLVED','CLOSED')),
  resolution text,
  assigned_admin_id uuid REFERENCES pim_v2.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS support_reporter_idx ON pim_v2.support_cases(reporter_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_status_idx ON pim_v2.support_cases(status,priority,created_at);

CREATE TABLE IF NOT EXISTS pim_v2.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  booking_updates boolean NOT NULL DEFAULT true,
  chat_updates boolean NOT NULL DEFAULT true,
  service_updates boolean NOT NULL DEFAULT true,
  marketing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
