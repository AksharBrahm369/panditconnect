import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("scheduled Puja requests tell the Pandit to confirm muhurat and samagri", async () => {
  const bookings = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const dispatch = await readFile(new URL("../lib/booking-dispatch.ts", import.meta.url), "utf8");
  const notifications = await readFile(new URL("../lib/push-notifications.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(bookings, /Scheduled Puja needs your guidance/);
  assert.match(bookings, /confirm the right muhurat/);
  assert.match(bookings, /samagri list in private chat/);
  assert.match(dispatch, /confirm the muhurat and samagri in private chat/);
  assert.match(notifications, /SCHEDULED_PUJA_GUIDANCE_REQUIRED/);
  assert.match(worker, /SCHEDULED_PUJA_GUIDANCE_REQUIRED/);
});

test("scheduled booking phone stays private until exactly two days before Puja", async () => {
  const bookings = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const chat = await readFile(new URL("../components/booking-chat.tsx", import.meta.url), "utf8");

  assert.match(bookings, /b\.scheduled_at-interval '2 days'/);
  assert.match(bookings, /now\(\)>=b\.scheduled_at-interval '2 days'/);
  assert.match(bookings, /AS pandit_phone_available_at/);
  assert.match(customer, /phoneAvailableAt=\{booking\.pandit_phone_available_at\}/);
  assert.match(chat, /Phone number unlocks on/);
  assert.match(chat, /exactly two days before the scheduled Puja/);
});

test("accepted scheduled bookings provide private planning chat to both parties", async () => {
  const schedule = await readFile(new URL("../components/pandit-schedule.tsx", import.meta.url), "utf8");
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");

  assert.match(schedule, /Confirm muhurat and samagri/);
  assert.match(schedule, /<BookingChat/);
  assert.match(schedule, /role="PANDIT"/);
  assert.match(customer, /guidanceMode=\{booking\.request_type === "SCHEDULED_PUJA"\}/);
});
