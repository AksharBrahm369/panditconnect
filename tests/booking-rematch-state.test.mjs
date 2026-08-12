import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("replacement matching excludes declined Pandits and starts a fresh requested journey", async () => {
  const route = await readFile(new URL("../app/api/bookings/[id]/rematch/route.ts", import.meta.url), "utf8");
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");

  assert.match(route, /COALESCE\(declined_pandit_ids,ARRAY\[\]::uuid\[\]\)/);
  assert.match(route, /NOT \(p\.user_id = ANY\(o\.excluded_pandit_ids\)\)/);
  assert.match(route, /p\.user_id<>o\.customer_id/);
  assert.match(route, /FOR UPDATE/);
  assert.match(route, /b\.status='DECLINED'/);
  assert.match(route, /status='REQUESTED'/);
  assert.match(route, /arrival_otp_attempts=0/);
  assert.match(route, /accepted_at=NULL,completed_at=NULL/);
  assert.match(route, /payment_method=NULL,payment_status='NOT_SELECTED'/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.match(customer, /if \(rematchingId\) return/);
  assert.match(customer, /status: "REQUESTED"/);
  assert.match(customer, /pandit_name: data\.matchedPandit!\.name/);
  assert.match(customer, /pandit_latitude: null/);
});

test("an exhausted broadcast can retry when a newly approved nearby Pandit becomes available", async () => {
  const [route, bookings, customer] = await Promise.all([
    readFile(new URL("../app/api/bookings/[id]/rematch/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /pandit_id IS NULL THEN COALESCE\(declined_pandit_ids/);
  assert.match(route, /dispatch_status='ASSIGNED'/);
  assert.match(route, /o\.scheduled_at IS NULL AND NOT EXISTS/);
  assert.match(bookings, /available_now_count/);
  assert.match(customer, /Search nearby Pandits again/);
  assert.match(customer, /Availability has changed since your previous search/);
});
