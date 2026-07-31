CREATE TABLE IF NOT EXISTS pim_v2.consultation_typing (
  consultation_id uuid NOT NULL REFERENCES pim_v2.consultations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (consultation_id, sender_id)
);
CREATE INDEX IF NOT EXISTS consultation_typing_expiry_idx
  ON pim_v2.consultation_typing(expires_at);
