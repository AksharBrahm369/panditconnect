import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function loadGuide() {
  const source = await readFile(new URL("../lib/ritual-guide.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("a death last month recommends Masik Shraddha instead of Ganesh Puja", async () => {
  const { recommendRitual } = await loadGuide();
  const result = recommendRitual("my uncle die last month");

  assert.equal(result.serviceId, "shraddha-puja");
  assert.equal(result.title, "Masik Shraddha / Ancestor Ritual");
  assert.match(result.reason, /date of passing, tithi and family tradition/i);
  assert.doesNotMatch(result.title, /Ganesh/i);
});

test("common bereavement phrases map to ancestor-ritual guidance", async () => {
  const { recommendRitual } = await loadGuide();
  for (const situation of ["My father passed away", "Shraddha for grandfather", "Need pind daan guidance", "Annual barsi"]) {
    assert.equal(recommendRitual(situation).serviceId, "shraddha-puja", situation);
  }
});

test("Shraddha is an active, idempotently seeded service", async () => {
  const migration = await readFile(new URL("../db/migrations/0029_shraddha_service.sql", import.meta.url), "utf8");
  assert.match(migration, /'shraddha-puja'/);
  assert.match(migration, /Masik Shraddha/);
  assert.match(migration, /ON CONFLICT\(id\) DO UPDATE/i);
  assert.match(migration, /active=EXCLUDED\.active/i);
});
