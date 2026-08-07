import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customers can discover nearby Pandits and open privacy-safe profiles", async () => {
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const discovery = await readFile(new URL("../app/api/pandits/discover/route.ts", import.meta.url), "utf8");
  const profile = await readFile(new URL("../app/customer/pandits/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(portal, /Show Pandits near me/);
  assert.match(portal, /Request this Pandit/);
  assert.match(portal, /Know more about/);
  assert.match(discovery, /requireCustomer/);
  assert.match(discovery, /verification_status='APPROVED'/);
  assert.match(discovery, /p\.distance <= p\.service_radius_km/);
  assert.match(profile, /Pujas and charges/);
  assert.match(profile, /Phone number, personal address, documents and payment details stay private/);
  assert.doesNotMatch(profile, /current_address|u\.phone|bank_account|upi_id/);
});
