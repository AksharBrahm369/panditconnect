CREATE TABLE IF NOT EXISTS pim_v2.api_rate_limits (
  scope text NOT NULL,
  subject_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(scope,subject_hash)
);
CREATE INDEX IF NOT EXISTS api_rate_limit_cleanup_idx ON pim_v2.api_rate_limits(updated_at);

ALTER TABLE pim_v2.support_cases DROP CONSTRAINT IF EXISTS support_cases_category_check;
ALTER TABLE pim_v2.support_cases ADD CONSTRAINT support_cases_category_check CHECK (category IN ('NO_SHOW','SAFETY','SERVICE_QUALITY','BOOKING','CHAT','ACCOUNT','PAYMENT','REFUND','PRIVACY','GRIEVANCE','OTHER'));
ALTER TABLE pim_v2.support_cases
  ADD COLUMN IF NOT EXISTS first_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_reference text;
UPDATE pim_v2.support_cases SET
  first_response_due_at=COALESCE(first_response_due_at,created_at+CASE WHEN priority='URGENT' THEN interval '1 hour' ELSE interval '1 day' END),
  resolution_due_at=COALESCE(resolution_due_at,created_at+CASE WHEN priority='URGENT' THEN interval '1 day' ELSE interval '7 days' END);

CREATE TABLE IF NOT EXISTS pim_v2.security_incidents (
  id uuid PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CONTAINED','RESOLVED','CLOSED')),
  title text NOT NULL,
  summary text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  contained_at timestamptz,
  resolved_at timestamptz,
  owner_id uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  postmortem text
);
CREATE INDEX IF NOT EXISTS security_incident_status_idx ON pim_v2.security_incidents(status,severity,detected_at DESC);

CREATE TABLE IF NOT EXISTS pim_v2.credential_rotation_log (
  id uuid PRIMARY KEY,
  credential_name text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  next_rotation_due_at timestamptz NOT NULL,
  rotated_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  note text
);

ALTER TABLE pim_v2.pandit_verification_reviews
  ADD COLUMN IF NOT EXISTS identity_method text,
  ADD COLUMN IF NOT EXISTS identity_reference text,
  ADD COLUMN IF NOT EXISTS bank_method text,
  ADD COLUMN IF NOT EXISTS bank_reference text,
  ADD COLUMN IF NOT EXISTS reference_checked_at timestamptz;
