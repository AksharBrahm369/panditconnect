import { Client, type QueryResultRow } from "pg";

function cleanConnectionString(value: string | undefined) {
  if (!value) return undefined;
  // Recover from an environment line accidentally appended after the closing
  // quote, e.g. .../postgres"OTP_PROVIDER="development".
  return value.match(/^(postgres(?:ql)?:\/\/[^"\s]+)/i)?.[1];
}

function databaseConfig() {
  // The transaction pooler is ideal for serverless production requests, while
  // the session/direct connection is more stable for Vinext's local worker.
  const connectionString = process.env.NODE_ENV === "development"
    ? cleanConnectionString(process.env.DIRECT_URL) || cleanConnectionString(process.env.DATABASE_URL)
    : cleanConnectionString(process.env.DATABASE_URL);
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
