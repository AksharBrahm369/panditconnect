import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const migrationName = process.argv[2];
if (!migrationName || !/^\d{4}_[a-z0-9_]+\.sql$/.test(migrationName)) {
  throw new Error("Usage: node --env-file=.env scripts/apply-migration.mjs 0023_example.sql");
}
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required");
const migrationSql = await readFile(path.join(process.cwd(), "db", "migrations", migrationName), "utf8");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });

await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('pim_v2_schema_migrations'))");
  await client.query("CREATE SCHEMA IF NOT EXISTS pim_v2");
  await client.query("CREATE TABLE IF NOT EXISTS pim_v2.schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())");
  const existing = await client.query("SELECT 1 FROM pim_v2.schema_migrations WHERE name=$1", [migrationName]);
  if (existing.rows[0]) {
    await client.query("ROLLBACK");
    console.log(`${migrationName} was already applied.`);
  } else {
    await client.query(migrationSql);
    await client.query("INSERT INTO pim_v2.schema_migrations(name) VALUES($1)", [migrationName]);
    await client.query("COMMIT");
    console.log(`${migrationName} applied successfully.`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
