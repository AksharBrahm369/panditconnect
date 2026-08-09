ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS request_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_rematch_count integer NOT NULL DEFAULT 0;

UPDATE pim_v2.bookings
SET request_expires_at = created_at + CASE
  WHEN request_type = 'SCHEDULED_PUJA' THEN interval '24 hours'
  ELSE interval '5 minutes'
END
WHERE status = 'REQUESTED' AND request_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS booking_request_expiry_idx
ON pim_v2.bookings(request_expires_at)
WHERE status = 'REQUESTED';

CREATE INDEX IF NOT EXISTS booking_scheduled_reminder_idx
ON pim_v2.bookings(scheduled_at)
WHERE scheduled_at IS NOT NULL AND reminder_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS pim_v2.push_delivery_queue (
  id uuid PRIMARY KEY,
  notification_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES pim_v2.push_subscriptions(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DELIVERED','FAILED','ABANDONED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  UNIQUE(notification_id, subscription_id)
);
CREATE INDEX IF NOT EXISTS push_retry_due_idx
ON pim_v2.push_delivery_queue(next_attempt_at)
WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS pim_v2.system_events (
  id uuid PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR','CRITICAL')),
  source text NOT NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_events_recent_idx ON pim_v2.system_events(created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_severity_idx ON pim_v2.system_events(severity,created_at DESC);

CREATE TABLE IF NOT EXISTS pim_v2.operation_runs (
  id uuid PRIMARY KEY,
  operation text NOT NULL,
  status text NOT NULL CHECK (status IN ('RUNNING','SUCCEEDED','FAILED')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS operation_runs_recent_idx ON pim_v2.operation_runs(operation,started_at DESC);

