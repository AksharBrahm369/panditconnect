ALTER TABLE pim_v2.pandit_profiles
  ADD COLUMN IF NOT EXISTS consultation_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consultation_rate_5min integer NOT NULL DEFAULT 99;

CREATE TABLE IF NOT EXISTS pim_v2.consultations (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  pandit_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  rate_5min integer NOT NULL,
  blocks integer NOT NULL DEFAULT 1 CHECK (blocks > 0),
  amount integer NOT NULL,
  payment_status text NOT NULL DEFAULT 'DEVELOPMENT',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS consultation_customer_idx ON pim_v2.consultations(customer_id, started_at DESC);
CREATE INDEX IF NOT EXISTS consultation_pandit_idx ON pim_v2.consultations(pandit_id, started_at DESC);

CREATE TABLE IF NOT EXISTS pim_v2.consultation_messages (
  id uuid PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES pim_v2.consultations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consultation_message_idx
  ON pim_v2.consultation_messages(consultation_id, created_at);
