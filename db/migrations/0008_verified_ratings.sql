ALTER TABLE pim_v2.bookings
  ADD COLUMN IF NOT EXISTS customer_rating integer CHECK (customer_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_comment text,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz;

ALTER TABLE pim_v2.pandit_profiles
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

UPDATE pim_v2.pandit_profiles p
SET rating=COALESCE((
      SELECT round(avg(b.customer_rating)::numeric,1)
      FROM pim_v2.bookings b
      WHERE b.pandit_id=p.user_id AND b.customer_rating IS NOT NULL
    ),0),
    rating_count=(
      SELECT count(*)::int
      FROM pim_v2.bookings b
      WHERE b.pandit_id=p.user_id AND b.customer_rating IS NOT NULL
    );
