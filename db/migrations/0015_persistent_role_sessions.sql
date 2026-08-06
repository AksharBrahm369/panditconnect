ALTER TABLE pim_v2.sessions
  ADD COLUMN IF NOT EXISTS session_role text;

UPDATE pim_v2.sessions s
SET session_role=u.role
FROM pim_v2.users u
WHERE u.id=s.user_id AND s.session_role IS NULL;

ALTER TABLE pim_v2.sessions
  ALTER COLUMN session_role SET NOT NULL;

ALTER TABLE pim_v2.sessions DROP CONSTRAINT IF EXISTS sessions_session_role_check;
ALTER TABLE pim_v2.sessions ADD CONSTRAINT sessions_session_role_check
  CHECK (session_role IN ('CUSTOMER','PANDIT','ADMIN'));
