import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured");

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
await client.connect();

try {
  const tables = [
    "users", "otp_challenges", "sessions", "services", "pandit_profiles",
    "pandit_services", "bookings", "consultations", "consultation_messages",
    "consultation_typing",
  ];
  const schema = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='pim_v2' AND table_name=ANY($1::text[])`,
    [tables],
  );
  const found = new Set(schema.rows.map((row) => row.table_name));
  const missingTables = tables.filter((table) => !found.has(table));

  const integrity = await client.query(
    `SELECT
      (SELECT count(*)::int FROM pim_v2.users u LEFT JOIN pim_v2.pandit_profiles p ON p.user_id=u.id WHERE u.role='PANDIT' AND p.user_id IS NULL) AS pandit_users_without_profile,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p LEFT JOIN pim_v2.users u ON u.id=p.user_id WHERE u.id IS NULL OR u.role<>'PANDIT') AS profiles_without_pandit_user,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p WHERE p.verification_status='APPROVED' AND NOT EXISTS(SELECT 1 FROM pim_v2.pandit_services ps WHERE ps.pandit_id=p.user_id)) AS approved_without_services,
      (SELECT count(*)::int FROM pim_v2.bookings b LEFT JOIN pim_v2.users u ON u.id=b.customer_id WHERE u.id IS NULL OR u.role<>'CUSTOMER') AS bookings_without_customer,
      (SELECT count(*)::int FROM pim_v2.bookings b LEFT JOIN pim_v2.users u ON u.id=b.pandit_id WHERE b.pandit_id IS NOT NULL AND (u.id IS NULL OR u.role<>'PANDIT')) AS bookings_without_valid_pandit,
      (SELECT count(*)::int FROM pim_v2.bookings b LEFT JOIN pim_v2.services s ON s.id=b.service_id WHERE s.id IS NULL) AS bookings_without_service,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p WHERE p.rating_count<>(SELECT count(*)::int FROM pim_v2.bookings b WHERE b.pandit_id=p.user_id AND b.customer_rating IS NOT NULL)) AS rating_count_mismatches,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p WHERE p.completed_jobs<>(SELECT count(*)::int FROM pim_v2.bookings b WHERE b.pandit_id=p.user_id AND b.status='COMPLETED')) AS completed_count_mismatches,
      (SELECT count(*)::int FROM pim_v2.consultations c LEFT JOIN pim_v2.users cu ON cu.id=c.customer_id LEFT JOIN pim_v2.users pu ON pu.id=c.pandit_id WHERE cu.id IS NULL OR pu.id IS NULL) AS consultations_without_participants`,
  );
  const problems = Object.entries(integrity.rows[0]).filter(([, count]) => Number(count) > 0);

  if (missingTables.length || problems.length) {
    console.error(JSON.stringify({ connected: true, missingTables, integrityProblems: Object.fromEntries(problems) }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ connected: true, schema: "pim_v2", tables: tables.length, integrity: "healthy" }, null, 2));
  }
} finally {
  await client.end();
}
