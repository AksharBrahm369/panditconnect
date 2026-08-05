import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const connectionString = process.env.DATABASE_URL?.match(/^(postgres(?:ql)?:\/\/[^"\s]+)/i)?.[1];
if (!connectionString) throw new Error("DATABASE_URL is not configured");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
await client.connect();
try {
  const tables = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  const sourceRoots = ["app", "components", "lib", "scripts"];
  const sourceFiles = [];
  async function collect(directory) { for (const entry of await readdir(directory,{withFileTypes:true})) { const full=path.join(directory,entry.name); if (entry.isDirectory()) await collect(full); else if (/\.(ts|tsx|mjs)$/.test(entry.name)) sourceFiles.push(full); } }
  for (const root of sourceRoots) await collect(root);
  const source = (await Promise.all(sourceFiles.map((file) => readFile(file,"utf8")))).join("\n");
  const report = tables.rows.map(({ tablename }) => ({ table: `public.${tablename}`, classification: new RegExp(`public\\.${tablename.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`,"i").test(source) ? "still referenced" : tablename === "_prisma_migrations" ? "requires review" : "safe to archive after manual approval" }));
  console.log(JSON.stringify({ authoritativeSchema: "pim_v2", destructiveActionsPerformed: false, legacyTables: report }, null, 2));
} finally { await client.end(); }
