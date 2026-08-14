import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("scheduled Pujas create a persistent Pandit reminder with a loud in-app alarm", async () => {
  const operations = await source("../lib/scheduled-operations.ts");
  const notifications = await source("../components/notification-center.tsx");
  const worker = await source("../public/sw.js");
  const push = await source("../lib/push-notifications.ts");

  assert.match(operations, /between now\(\) AND now\(\)\+interval '48 hours'/i);
  assert.match(operations, /Puja reminder: prepare now/);
  assert.match(operations, /SCHEDULED_PUJA_REMINDER/);
  assert.match(notifications, /PANDIT_ALARM_EVENTS/);
  assert.match(notifications, /SCHEDULED_PUJA_REMINDER/);
  assert.match(worker, /SCHEDULED_PUJA_REMINDER/);
  assert.match(push, /2 \* 24 \* 60 \* 60/);
});

test("the booking customer and assigned Pandit can add a private scheduled Puja calendar event", async () => {
  const calendar = await source("../app/api/bookings/[id]/calendar/route.ts");
  const schedule = await source("../components/pandit-schedule.tsx");
  const consent = await source("../components/booking-calendar-consent.tsx");

  assert.match(calendar, /user\.role !== "PANDIT"/);
  assert.match(calendar, /user\.role !== "CUSTOMER"/);
  assert.match(calendar, /b\.customer_id=\$3/);
  assert.match(calendar, /b\.pandit_id=\$3/);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /TRIGGER:-P1D/);
  assert.match(calendar, /TRIGGER:-PT2H/);
  assert.match(schedule, /BookingCalendarConsent/);
  assert.match(consent, /Would you like to add/);
  assert.match(consent, /Add to calendar/);
});

test("a customer reschedules the accepted Puja in place and the Pandit is alerted", async () => {
  const route = await source("../app/api/bookings/[id]/schedule/route.ts");
  const portal = await source("../components/customer-portal.tsx");
  const worker = await source("../public/sw.js");
  const notifications = await source("../components/notification-center.tsx");

  assert.match(route, /UPDATE pim_v2\.bookings booking SET scheduled_at=\$3,reminder_sent_at=NULL/);
  assert.doesNotMatch(route, /INSERT INTO pim_v2\.bookings/);
  assert.match(route, /other\.customer_id=booking\.customer_id OR other\.pandit_id=booking\.pandit_id/);
  assert.match(route, /BOOKING_SCHEDULE_UPDATED/);
  assert.match(route, /Customer updated the Puja date/);
  assert.match(portal, /Edit Puja date/);
  assert.match(portal, /Same booking · no new request/);
  assert.match(portal, /audience="CUSTOMER"/);
  assert.match(worker, /BOOKING_SCHEDULE_UPDATED/);
  assert.match(notifications, /BOOKING_SCHEDULE_UPDATED/);
});
