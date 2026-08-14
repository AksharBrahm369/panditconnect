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

test("the assigned Pandit can add a private scheduled Puja calendar event", async () => {
  const calendar = await source("../app/api/bookings/[id]/calendar/route.ts");
  const schedule = await source("../components/pandit-schedule.tsx");

  assert.match(calendar, /user\.role !== "PANDIT"/);
  assert.match(calendar, /b\.pandit_id=\$2/);
  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /TRIGGER:-P1D/);
  assert.match(calendar, /TRIGGER:-PT2H/);
  assert.match(schedule, /Would you like to add it to your phone or laptop calendar/);
  assert.match(schedule, /Add to calendar/);
});
