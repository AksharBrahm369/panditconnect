import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customers can schedule a future Puja with a nearby available Pandit", async () => {
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const bookings = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const nearby = await readFile(new URL("../app/api/pandits/nearby/route.ts", import.meta.url), "utf8");
  const pandit = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/0022_scheduled_puja.sql", import.meta.url), "utf8");
  assert.match(customer, /Schedule for later/);
  assert.match(customer, /Preferred date/);
  assert.match(customer, /Let the Pandit recommend/);
  assert.match(customer, /scheduledAt/);
  assert.match(bookings, /SCHEDULED_PUJA/);
  assert.match(bookings, /at least 2 hours/);
  assert.match(bookings, /busy\.scheduled_at BETWEEN/);
  assert.match(nearby, /bookingMode/);
  assert.match(nearby, /NOT EXISTS/);
  assert.match(pandit, /Scheduled date and time/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS scheduled_at timestamptz/);
});

test("scheduled bookings cannot begin travelling too early", async () => {
  const transition = await readFile(new URL("../app/api/bookings/[id]/route.ts", import.meta.url), "utf8");
  assert.match(transition, /The customer scheduled this Puja for/);
  assert.match(transition, /Asia\/Kolkata/);
  assert.match(transition, /weekday: "long"/);
  assert.match(transition, /scheduledAt: booking\.scheduled_at/);
  assert.match(transition, /4 \* 60 \* 60 \* 1000/);
});
