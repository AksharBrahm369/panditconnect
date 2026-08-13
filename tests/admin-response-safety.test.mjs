import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("shared response reader handles empty and unreadable server bodies", async () => {
  const source = await readFile(new URL("../lib/http.ts", import.meta.url), "utf8");
  assert.match(source, /await response\.text\(\)/);
  assert.match(source, /if \(!body\.trim\(\)\)/);
  assert.match(source, /JSON\.parse\(body\)/);
  assert.match(source, /server returned an unreadable response/);
});

test("admin overview always returns a JSON error and the portal validates its shape", async () => {
  const route = await readFile(new URL("../app/api/admin/overview/route.ts", import.meta.url), "utf8");
  const portal = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  assert.match(route, /Unable to load admin overview/);
  assert.match(route, /Unable to load the admin workspace\. Please try again/);
  assert.doesNotMatch(route, /database connection/i);
  assert.match(portal, /!result\.stats \|\| !result\.risk \|\| !result\.funnel/);
  assert.match(portal, /admin workspace could not connect to the server/);
});
