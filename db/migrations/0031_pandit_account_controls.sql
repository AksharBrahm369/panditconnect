ALTER TABLE pim_v2.users DROP CONSTRAINT IF EXISTS user_account_status_check;

UPDATE pim_v2.users SET account_status='BLOCKED' WHERE account_status='SUSPENDED';

ALTER TABLE pim_v2.users
  ADD COLUMN IF NOT EXISTS account_status_reason text,
  ADD COLUMN IF NOT EXISTS account_status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status_changed_by uuid REFERENCES pim_v2.users(id);

ALTER TABLE pim_v2.users ADD CONSTRAINT user_account_status_check
  CHECK (account_status IN ('ACTIVE','RESTRICTED','BLOCKED','DELETION_REQUESTED','DELETED'));

CREATE INDEX IF NOT EXISTS user_pandit_account_status_idx
  ON pim_v2.users(account_status)
  WHERE role='PANDIT';
