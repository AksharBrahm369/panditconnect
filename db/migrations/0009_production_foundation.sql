-- Production foundation: reference data, administrator auditing and operational indexes.
ALTER TABLE pim_v2.services
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE pim_v2.otp_challenges
  ADD COLUMN IF NOT EXISTS request_ip text;

CREATE TABLE IF NOT EXISTS pim_v2.admin_audit_logs (
  id uuid PRIMARY KEY,
  admin_user_id uuid REFERENCES pim_v2.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON pim_v2.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_admin_idx ON pim_v2.admin_audit_logs(admin_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS otp_ip_created_idx ON pim_v2.otp_challenges(request_ip,created_at DESC);
CREATE INDEX IF NOT EXISTS session_expiry_idx ON pim_v2.sessions(expires_at);
CREATE INDEX IF NOT EXISTS pandit_verification_idx ON pim_v2.pandit_profiles(verification_status,updated_at DESC);
CREATE INDEX IF NOT EXISTS pandit_available_idx ON pim_v2.pandit_profiles(is_online,verification_status) WHERE is_online=true;

INSERT INTO pim_v2.services(id,name,description,base_price,duration_minutes,active) VALUES
  ('ganesh-puja','Ganesh Puja','Auspicious worship for new beginnings.',1100,45,true),
  ('lakshmi-puja','Lakshmi Puja','Worship for prosperity and harmony.',1600,60,true),
  ('satyanarayan','Satyanarayan Puja','Complete katha and Puja for family wellbeing.',2100,75,true),
  ('havan','Havan / Homam','Sacred fire ritual for purification.',2500,75,true),
  ('griha-pravesh','Griha Pravesh','Traditional ceremony for entering a new home.',3100,90,true),
  ('religious-guidance','Religious Guidance / Pandit Consultation','Private online guidance from an approved Pandit.',99,5,true)
ON CONFLICT(id) DO NOTHING;
