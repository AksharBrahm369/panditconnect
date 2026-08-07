CREATE TABLE IF NOT EXISTS pim_v2.customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  email text,
  default_address text,
  preferred_language text NOT NULL DEFAULT 'Hindi',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pim_v2.customer_profiles(user_id)
SELECT id FROM pim_v2.users WHERE role='CUSTOMER'
ON CONFLICT(user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS customer_profiles_updated_idx
  ON pim_v2.customer_profiles(updated_at DESC);
