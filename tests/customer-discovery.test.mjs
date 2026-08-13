import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customers can discover nearby Pandits and open privacy-safe profiles", async () => {
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const nearby = await readFile(new URL("../app/api/pandits/nearby/route.ts", import.meta.url), "utf8");
  const profile = await readFile(new URL("../app/customer/pandits/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(portal, /Compare nearby Pandits/);
  assert.match(portal, /Send request to/);
  assert.match(portal, /\/api\/pandits\/nearby/);
  assert.doesNotMatch(portal, /\/api\/pandits\/discover/);
  assert.match(nearby, /verification_status='APPROVED'/);
  assert.match(nearby, /distance <= service_radius_km/);
  assert.match(nearby, /p\.latitude IS NOT NULL AND p\.longitude IS NOT NULL/);
  assert.match(profile, /Pujas and charges/);
  assert.match(profile, /Phone number, personal address, documents and payment details stay private/);
  assert.doesNotMatch(profile, /current_address|u\.phone|bank_account|upi_id/);
});
