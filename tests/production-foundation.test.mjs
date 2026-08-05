import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("foundation-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("anonymous visitors are redirected away from the admin portal", async () => {
  const response = await render("/admin");
  assert.ok([302, 303, 307, 308].includes(response.status));
  assert.match(response.headers.get("location") ?? "", /\/admin\/login/);
});

test("admin login page is available", async () => {
  const response = await render("/admin/login");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Administrator sign in/);
});

test("admin API requires authentication", async () => {
  const response = await render("/api/admin/overview");
  assert.equal(response.status, 401);
});

test("service migration is idempotent and contains all permanent services", async () => {
  const migration = await readFile(new URL("../db/migrations/0009_production_foundation.sql", import.meta.url), "utf8");
  for (const id of ["ganesh-puja", "lakshmi-puja", "satyanarayan", "havan", "griha-pravesh", "religious-guidance"]) assert.match(migration, new RegExp(`'${id}'`));
  assert.match(migration, /ON CONFLICT\(id\) DO NOTHING/i);
});

test("active application database queries use the pim_v2 schema", async () => {
  const files = ["../lib/auth.ts", "../app/api/services/route.ts", "../app/api/admin/overview/route.ts", "../app/api/admin/pandits/route.ts"];
  for (const relative of files) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(public\.User|public\.PanditProfile|public\.Booking|public\.PujaService)\b/i);
  }
});

test("secret files are ignored while the placeholder file is committed", async () => {
  const ignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(ignore, /^\.env\*/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.doesNotMatch(example, /postgres(?:ql)?:\/\/[^"\s]+:[^"\s]+@/i);
});
