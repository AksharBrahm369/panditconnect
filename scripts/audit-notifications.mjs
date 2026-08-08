import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const database = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
try {
  const summary = await database.query(`SELECT
    (SELECT count(*)::int FROM pim_v2.push_subscriptions) AS subscriptions,
    (SELECT count(DISTINCT user_id)::int FROM pim_v2.push_subscriptions) AS subscribed_users,
    (SELECT count(*)::int FROM pim_v2.notifications WHERE created_at > now() - interval '24 hours') AS notifications_24h,
    (SELECT count(*)::int FROM pim_v2.notifications WHERE event_type='BOOKING_REQUESTED' AND created_at > now() - interval '24 hours') AS booking_requests_24h,
    (SELECT count(*)::int FROM pim_v2.push_subscriptions WHERE updated_at > now() - interval '24 hours') AS subscriptions_refreshed_24h`);
  const roles = await database.query(`SELECT u.role,count(*)::int AS devices
    FROM pim_v2.push_subscriptions s JOIN pim_v2.users u ON u.id=s.user_id
    GROUP BY u.role ORDER BY u.role`);
  console.log(JSON.stringify({ ...summary.rows[0], devices_by_role: roles.rows }, null, 2));
} finally {
  await database.end();
}
