import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

async function loadPreparation() {
  const input = await source("../lib/puja-preparation.ts");
  const output = ts.transpileModule(input, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("Puja preparation uses service-specific samagri and safe Shraddha guidance", async () => {
  const { pujaPreparation } = await loadPreparation();
  const griha = pujaPreparation("griha-pravesh");
  const shraddha = pujaPreparation("shraddha-puja");

  assert.match(griha.title, /Griha Pravesh/i);
  assert.ok(griha.essentials.some((item) => /milk/i.test(item)));
  assert.match(shraddha.title, /Shraddha/i);
  assert.match(shraddha.confirmation, /do not rely on a generic date/i);
  assert.notEqual(griha.title, pujaPreparation("ganesh-puja").title);
});

test("Panchang lookup is authenticated, rate limited and keeps its API key server-side", async () => {
  const route = await source("../app/api/ritual-preparation/route.ts");
  const env = await source("../.env.example");

  assert.match(route, /currentUser\(\)/);
  assert.match(route, /user\.role !== "CUSTOMER"/);
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /process\.env\.TATHAASTU_API_KEY/);
  assert.match(route, /"X-API-Key": apiKey/);
  assert.match(route, /api\.tathaastuapi\.com\/v1\/panchang/);
  assert.match(route, /include", "timings"/);
  assert.match(env, /^TATHAASTU_API_KEY=""$/m);
  assert.doesNotMatch(route + env, /NEXT_PUBLIC_TATHAASTU/);
});

test("customer can request and review samagri, Tithi, Nakshatra and safe muhurta guidance", async () => {
  const portal = await source("../components/customer-portal.tsx");
  const styles = await source("../app/globals.css");

  assert.match(portal, /Show samagri and Panchang guide/);
  assert.match(portal, />Tithi</);
  assert.match(portal, />Nakshatra</);
  assert.match(portal, /General Abhijit Muhurat/);
  assert.match(portal, /Avoid · Rahu Kaal/);
  assert.match(portal, /Final confirmation is required/);
  assert.match(portal, /confirm the final ritual-specific muhurta with the Pandit/i);
  assert.match(styles, /\.puja-preparation-guide/);
  assert.match(styles, /@media \(max-width:700px\)/);
});
