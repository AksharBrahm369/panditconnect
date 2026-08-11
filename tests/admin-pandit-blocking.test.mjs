import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Pandit block and unblock are protected admin actions", async () => {
  const [route, portal, auth] = await Promise.all([
    read("app/api/admin/support-cases/route.ts"),
    read("components/admin-portal.tsx"),
    read("app/api/auth/verify/route.ts"),
  ]);

  assert.match(route, /requireAdmin/);
  assert.match(route, /PANDIT_BLOCKED/);
  assert.match(route, /PANDIT_UNBLOCKED/);
  assert.match(route, /account_status=\$2/);
  assert.match(route, /DELETE FROM pim_v2\.sessions/);
  assert.match(route, /is_online=false,consultation_online=false/);
  assert.match(portal, /"Block Pandit"/);
  assert.match(portal, /"Unblock Pandit"/);
  assert.match(auth, /account_status !== "ACTIVE"/);
});

test("blocked Pandits are excluded from every customer matching path", async () => {
  const files = [
    "app/api/pandits/nearby/route.ts",
    "app/api/pandits/discover/route.ts",
    "app/api/consultation-pandits/route.ts",
    "app/api/consultations/route.ts",
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
