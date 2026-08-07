import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Puja matching strictly enforces the customer's preferred language", async () => {
  const nearby = await readFile(new URL("../app/api/pandits/nearby/route.ts", import.meta.url), "utf8");
  const bookings = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const rematch = await readFile(new URL("../app/api/bookings/[id]/rematch/route.ts", import.meta.url), "utf8");
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  assert.match(portal, /serviceId, language/);
  assert.match(nearby, /language\.toLowerCase\(\)/);
  assert.match(nearby, /unnest\(p\.languages\)/);
  assert.match(bookings, /preferredLanguage/);
  assert.match(bookings, /unnest\(p\.languages\)/);
  assert.match(rematch, /unnest\(p\.languages\)/);
  assert.doesNotMatch(rematch, /CASE WHEN o\.preferred_language/);
});
