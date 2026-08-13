import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("fallback dispatch broadcasts only to approved matching nearby Pandits in staged radii", async () => {
  const dispatch = await read("../lib/booking-dispatch.ts");
  for (const expected of ["[5, 10, 20, 40]", "verification_status='APPROVED'", "p.is_online=true", "unnest(p.languages)", "service_radius_km", "OFFER_WINDOW_MINUTES = 3"]) {
    assert.match(dispatch, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(dispatch, /LIMIT 8/);
  assert.match(dispatch, /travelSurchargeForRadius/);
  assert.match(dispatch, /dispatch_status='EXHAUSTED'/);
});

test("first valid broadcast acceptance wins and closes every competing offer", async () => {
  const transition = await read("../app/api/bookings/[id]/route.ts");
  assert.match(transition, /b\.pandit_id IS NULL/);
  assert.match(transition, /status='ACCEPTED'/);
  assert.match(transition, /status='WITHDRAWN'/);
  assert.match(transition, /Another Pandit already accepted this request/);
});

test("customer fallback UI keeps automatic search details internal and shows useful next actions", async () => {
  const fallback = await read("../components/availability-fallback.tsx");
  const customer = await read("../components/customer-portal.tsx");
  for (const copy of ["No one nearby has accepted yet", "Keep searching automatically", "Talk to a Pandit online now", "Reserve the earliest visit"]) {
    assert.match(fallback, new RegExp(copy));
  }
  assert.match(customer, /dispatchMode:"BROADCAST"/);
  assert.match(customer, /RESERVE_EARLIEST/);
  assert.doesNotMatch(fallback, /travel surcharge|expands every 3 minutes/);
});

test("fallback dispatch is persisted in additive database tables", async () => {
  const migration = await read("../db/migrations/0030_multi_pandit_fallback_dispatch.sql");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pim_v2\.booking_offers/);
  assert.match(migration, /UNIQUE \(booking_id,pandit_id\)/);
  assert.match(migration, /booking_dispatch_due_idx/);
});
