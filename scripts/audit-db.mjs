import pg from "pg";

const rawConnection = process.env.DATABASE_URL;
const connectionString = rawConnection?.match(/^(postgres(?:ql)?:\/\/[^"\s]+)/i)?.[1];
if (!connectionString) throw new Error("DATABASE_URL is not configured");

const expectedTables = [
  "users", "otp_challenges", "sessions", "services", "pandit_profiles", "pandit_services",
  "bookings", "consultations", "consultation_messages", "consultation_typing", "admin_audit_logs",
];
const expectedIndexes = [
  "otp_phone_created_idx", "otp_ip_created_idx", "session_expiry_idx", "booking_customer_idx",
  "booking_pandit_idx", "booking_status_created_idx", "pandit_verification_idx", "pandit_available_idx",
  "consultation_customer_idx", "consultation_pandit_idx", "consultation_message_idx",
  "consultation_typing_expiry_idx", "admin_audit_created_idx", "admin_audit_admin_idx",
];

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
await client.connect();
try {
  const schema = await client.query(`SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='pim_v2') AS exists`);
  const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='pim_v2' AND table_name=ANY($1::text[])`, [expectedTables]);
  const indexes = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname='pim_v2' AND indexname=ANY($1::text[])`, [expectedIndexes]);
  const constraints = await client.query(`SELECT count(*)::int AS count FROM information_schema.table_constraints WHERE table_schema='pim_v2' AND constraint_type IN ('PRIMARY KEY','FOREIGN KEY','UNIQUE','CHECK')`);
  const foundTables = new Set(tables.rows.map((row) => row.table_name));
  const foundIndexes = new Set(indexes.rows.map((row) => row.indexname));
  const missingTables = expectedTables.filter((name) => !foundTables.has(name));
  const missingIndexes = expectedIndexes.filter((name) => !foundIndexes.has(name));

  let integrityProblems = {};
  if (!missingTables.length) {
    const integrity = await client.query(`SELECT
      (SELECT count(*)::int FROM pim_v2.users u LEFT JOIN pim_v2.pandit_profiles p ON p.user_id=u.id WHERE u.role='PANDIT' AND p.user_id IS NULL) AS pandit_users_without_profile,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p LEFT JOIN pim_v2.users u ON u.id=p.user_id WHERE u.id IS NULL OR u.role<>'PANDIT') AS profiles_without_pandit_user,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p WHERE p.verification_status='APPROVED' AND NOT EXISTS(SELECT 1 FROM pim_v2.pandit_services ps WHERE ps.pandit_id=p.user_id)) AS approved_without_services,
      (SELECT count(*)::int FROM pim_v2.bookings b LEFT JOIN pim_v2.users u ON u.id=b.customer_id WHERE u.id IS NULL OR u.role<>'CUSTOMER') AS bookings_without_customer,
      (SELECT count(*)::int FROM pim_v2.bookings b LEFT JOIN pim_v2.users u ON u.id=b.pandit_id WHERE b.pandit_id IS NOT NULL AND (u.id IS NULL OR u.role<>'PANDIT')) AS bookings_without_valid_pandit,
      (SELECT count(*)::int FROM pim_v2.bookings b LEFT JOIN pim_v2.services s ON s.id=b.service_id WHERE s.id IS NULL) AS bookings_without_service,
      (SELECT count(*)::int FROM pim_v2.pandit_services ps LEFT JOIN pim_v2.users u ON u.id=ps.pandit_id LEFT JOIN pim_v2.services s ON s.id=ps.service_id WHERE u.id IS NULL OR u.role<>'PANDIT' OR s.id IS NULL) AS orphaned_pandit_services,
      (SELECT count(*)::int FROM pim_v2.sessions s LEFT JOIN pim_v2.users u ON u.id=s.user_id WHERE s.expires_at>now() AND u.id IS NULL) AS active_sessions_without_user,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p WHERE p.rating_count<>(SELECT count(*)::int FROM pim_v2.bookings b WHERE b.pandit_id=p.user_id AND b.customer_rating IS NOT NULL)) AS rating_count_mismatches,
      (SELECT count(*)::int FROM pim_v2.pandit_profiles p WHERE p.completed_jobs<>(SELECT count(*)::int FROM pim_v2.bookings b WHERE b.pandit_id=p.user_id AND b.status='COMPLETED')) AS completed_count_mismatches,
      (SELECT count(*)::int FROM pim_v2.consultations c LEFT JOIN pim_v2.users cu ON cu.id=c.customer_id LEFT JOIN pim_v2.users pu ON pu.id=c.pandit_id WHERE cu.id IS NULL OR cu.role<>'CUSTOMER' OR pu.id IS NULL OR pu.role<>'PANDIT') AS consultations_without_valid_participants`);
    integrityProblems = Object.fromEntries(Object.entries(integrity.rows[0]).filter(([, count]) => Number(count) > 0));
  }
  const healthy = schema.rows[0]?.exists && !missingTables.length && !missingIndexes.length && Number(constraints.rows[0]?.count) > 0 && !Object.keys(integrityProblems).length;
  const report = { connected: true, schema: schema.rows[0]?.exists ? "present" : "missing", tables: `${foundTables.size}/${expectedTables.length}`, indexes: `${foundIndexes.size}/${expectedIndexes.length}`, constraints: Number(constraints.rows[0]?.count), integrity: healthy ? "healthy" : "failed", ...(missingTables.length ? { missingTables } : {}), ...(missingIndexes.length ? { missingIndexes } : {}), ...(Object.keys(integrityProblems).length ? { integrityProblems } : {}) };
  (healthy ? console.log : console.error)(JSON.stringify(report, null, 2));
  if (!healthy) process.exitCode = 1;
} finally { await client.end(); }
