ALTER TABLE pim_v2.users DROP CONSTRAINT IF EXISTS user_account_status_check;
ALTER TABLE pim_v2.users ADD CONSTRAINT user_account_status_check CHECK (account_status IN ('ACTIVE','SUSPENDED','DELETION_REQUESTED','DELETED'));

CREATE TABLE IF NOT EXISTS pim_v2.data_rights_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('EXPORT','ACCOUNT_DELETION','DOCUMENT_DELETION','CONSENT_WITHDRAWAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_REVIEW','COMPLETED','REJECTED','CANCELLED')),
  details text,
  resolution text,
  handled_by uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS data_rights_user_idx ON pim_v2.data_rights_requests(user_id,requested_at DESC);
CREATE INDEX IF NOT EXISTS data_rights_status_idx ON pim_v2.data_rights_requests(status,request_type,requested_at);
CREATE UNIQUE INDEX IF NOT EXISTS data_rights_one_open_request_idx ON pim_v2.data_rights_requests(user_id,request_type) WHERE status IN ('OPEN','IN_REVIEW');

CREATE TABLE IF NOT EXISTS pim_v2.user_consents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  granted_at timestamptz,
  revoked_at timestamptz,
  policy_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_consents_timeline_idx ON pim_v2.user_consents(user_id,consent_type,created_at DESC);
