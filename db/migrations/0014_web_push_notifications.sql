CREATE TABLE IF NOT EXISTS pim_v2.push_subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pim_v2.notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/',
  event_type text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON pim_v2.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON pim_v2.notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON pim_v2.notifications(user_id) WHERE read_at IS NULL;
