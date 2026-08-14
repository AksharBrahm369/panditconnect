-- Private, booking-scoped preparation chat between an assigned customer and Pandit.
CREATE TABLE IF NOT EXISTS pim_v2.booking_messages (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES pim_v2.bookings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES pim_v2.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_messages_booking_created_idx
  ON pim_v2.booking_messages(booking_id, created_at);

