-- Keep customer-facing Pandit aggregates derived from their authoritative
-- booking records. This repairs historical drift and prevents future mismatch
-- when a booking is rated, reassigned, completed, cancelled, or removed.

CREATE OR REPLACE FUNCTION pim_v2.refresh_pandit_booking_counters(target_pandit uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE pim_v2.pandit_profiles p
  SET rating = COALESCE((
        SELECT round(avg(b.customer_rating)::numeric, 1)
        FROM pim_v2.bookings b
        WHERE b.pandit_id = target_pandit AND b.customer_rating IS NOT NULL
      ), 0),
      rating_count = (
        SELECT count(*)::int
        FROM pim_v2.bookings b
        WHERE b.pandit_id = target_pandit AND b.customer_rating IS NOT NULL
      ),
      completed_jobs = (
        SELECT count(*)::int
        FROM pim_v2.bookings b
        WHERE b.pandit_id = target_pandit AND b.status = 'COMPLETED'
      ),
      updated_at = now()
  WHERE p.user_id = target_pandit;
$$;

CREATE OR REPLACE FUNCTION pim_v2.sync_pandit_booking_counters()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.pandit_id IS NOT NULL THEN
    PERFORM pim_v2.refresh_pandit_booking_counters(OLD.pandit_id);
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.pandit_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.pandit_id IS DISTINCT FROM NEW.pandit_id OR
          OLD.status IS DISTINCT FROM NEW.status OR
          OLD.customer_rating IS DISTINCT FROM NEW.customer_rating) THEN
    PERFORM pim_v2.refresh_pandit_booking_counters(NEW.pandit_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS bookings_sync_pandit_counters ON pim_v2.bookings;
CREATE TRIGGER bookings_sync_pandit_counters
AFTER INSERT OR UPDATE OF pandit_id, status, customer_rating OR DELETE
ON pim_v2.bookings
FOR EACH ROW EXECUTE FUNCTION pim_v2.sync_pandit_booking_counters();

SELECT pim_v2.refresh_pandit_booking_counters(user_id)
FROM pim_v2.pandit_profiles;
