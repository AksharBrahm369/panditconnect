import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Pandit block, restriction and restoration are protected admin actions", async () => {
  const [route, portal, auth, page, statusScreen, push, worker] = await Promise.all([
    read("app/api/admin/support-cases/route.ts"),
    read("components/admin-portal.tsx"),
    read("app/api/auth/verify/route.ts"),
    read("app/pandit/page.tsx"),
    read("components/pandit-access-status.tsx"),
    read("lib/push-notifications.ts"),
    read("public/sw.js"),
  ]);

  assert.match(route, /requireAdmin/);
  assert.match(route, /PANDIT_BLOCKED/);
  assert.match(route, /PANDIT_UNBLOCKED/);
  assert.match(route, /PANDIT_RESTRICTED/);
  assert.match(route, /account_status=\$2/);
  assert.match(route, /is_online=false,consultation_online=false/);
  assert.match(portal, />Block</);
  assert.match(portal, /Unblock Pandit/);
  assert.match(portal, />Restrict</);
  assert.match(auth, /account_status !== "ACTIVE"/);
  assert.match(page, /currentSessionUser/);
  assert.match(statusScreen, /You are restricted from PujaOne/);
  assert.match(statusScreen, /You have been blocked by the Admin/);
  assert.match(statusScreen, /SupportCenter/);
  assert.match(push, /MANDATORY_ACCOUNT_EVENTS/);
  assert.match(worker, /PANDIT_BLOCKED/);
});

test("Pandit account states are persisted by a reversible migration", async () => {
  const migration = await read("db/migrations/0031_pandit_account_controls.sql");
  assert.match(migration, /RESTRICTED/);
  assert.match(migration, /BLOCKED/);
  assert.match(migration, /account_status_reason/);
  assert.match(migration, /account_status_changed_by/);
  assert.match(migration, /SET account_status='BLOCKED' WHERE account_status='SUSPENDED'/);
});

test("blocked Pandits are excluded from every customer matching path", async () => {
  const files = [
    "app/api/pandits/nearby/route.ts",
    "app/api/consultation-pandits/route.ts",
    "app/api/payments/orders/route.ts",
    "app/api/bookings/route.ts",
    "app/api/bookings/[id]/rematch/route.ts",
    "app/api/pandits/[id]/photo/route.ts",
    "lib/booking-dispatch.ts",
    "lib/scheduled-operations.ts",
  ];

  for (const file of files) {
    const source = await read(file);
    assert.match(source, /account_status='ACTIVE'/, `${file} must exclude blocked Pandits`);
  }
});
