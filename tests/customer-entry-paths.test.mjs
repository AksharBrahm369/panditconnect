import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer entry paths avoid duplicate cancellation and direct-booking journeys", async () => {
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const homepage = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(portal, /<strong>My Pandit cancelled<\/strong>/);
  assert.doesNotMatch(homepage, /<strong>My Pandit cancelled<\/strong>/);
  assert.match(portal, /Choose a specific Puja/);
  assert.match(portal, /Direct Puja booking/);
  assert.match(portal, /Compare nearby Pandits/);
  assert.match(portal, /Find another Pandit/);
  assert.match(portal, /requestType === "KNOWN_PUJA" \? "Selected Puja" : "Recommended"/);
});
