UPDATE pim_v2.pandit_profiles p
SET completed_jobs=GREATEST(
  p.completed_jobs,
  (
    SELECT count(*)::int
    FROM pim_v2.bookings b
    WHERE b.pandit_id=p.user_id AND b.status='COMPLETED'
  )
);
