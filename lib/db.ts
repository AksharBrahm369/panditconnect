import { Client, type QueryResultRow } from "pg";

function databaseConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  return { connectionString, connectionTimeoutMillis: 10_000, keepAlive: true };
}

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  // Vinext development runs route handlers in Cloudflare request contexts.
  // A PostgreSQL socket cannot safely be reused by a later context, so each
  // database operation uses its own short-lived connection.
  const client = new Client(databaseConfig());
  await client.connect();
  try {
    return await client.query<T>(text, values);
  } finally {
    await client.end();
  }
}
