import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("large Pandit directories use server pagination and incremental loading", async () => {
  const [overview, adminApi, discoverApi, consultationApi, adminPortal, customerPortal, consultationPanel, pushNotifications] = await Promise.all([
    read("app/api/admin/overview/route.ts"),
    read("app/api/admin/pandits/route.ts"),
    read("app/api/pandits/discover/route.ts"),
    read("app/api/consultation-pandits/route.ts"),
    read("components/admin-portal.tsx"),
    read("components/customer-portal.tsx"),
    read("components/consultation-panel.tsx"),
    read("lib/push-notifications.ts"),
  ]);

  assert.doesNotMatch(overview, /approved_rows|row\.approved[,;\s]/);
  assert.match(adminApi, /LIMIT \$1 OFFSET \$2/);
  assert.match(adminApi, /hasMore/);
  assert.match(discoverApi, /limit = Math\.min\(12/);
  assert.match(discoverApi, /LIMIT \$3 OFFSET \$4/);
  assert.match(consultationApi, /LIMIT \$1 OFFSET \$2/);
  assert.match(adminPortal, /Load more approved Pandits/);
  assert.match(adminPortal, /Load more applications/);
  assert.match(customerPortal, /Show more nearby Pandits/);
  assert.match(consultationPanel, /Show more available Pandits/);
  assert.doesNotMatch(pushNotifications, /SELECT id,phone FROM pim_v2\.users/);
  assert.match(pushNotifications, /right\(regexp_replace\(phone/);
});

test("customer pages never preload a global Pandit directory", async () => {
  const [home, customerPortal, liveAvailability, retiredFeaturedApi] = await Promise.all([
    read("app/page.tsx"),
    read("components/customer-portal.tsx"),
    read("components/live-availability-card.tsx"),
    read("app/api/pandits/featured/route.ts"),
  ]);

  assert.doesNotMatch(home, /FeaturedPandits|pandits\/featured/);
  assert.match(customerPortal, /getCurrentCoordinates\(\)/);
  assert.match(customerPortal, /\/api\/pandits\/discover\?\$\{params\}/);
  assert.match(customerPortal, /\/api\/pandits\/nearby\?\$\{params\}/);
  assert.match(customerPortal, /Show more nearby Pandits/);
  assert.match(liveAvailability, /getCurrentCoordinates\(\)/);
  assert.match(liveAvailability, /\/api\/pandits\/nearby\?\$\{params\}/);
  assert.match(liveAvailability, /limit: "4"/);
  assert.doesNotMatch(retiredFeaturedApi, /pim_v2|\bsql\b/);
  assert.match(retiredFeaturedApi, /status: 410/);
});
