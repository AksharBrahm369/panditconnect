import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin approval uses the streamlined identity, document and reference checks", async () => {
  const portal = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  assert.match(portal, /Complete these checks before approval/);
  assert.match(portal, /action: "UPDATE_CHECKLIST"/);
  assert.match(portal, /Choose how the identity was verified/);
  assert.doesNotMatch(portal, /Choose how the bank or UPI account was verified/);
  assert.doesNotMatch(portal, /Puja knowledge check/);
  assert.match(portal, /Never enter the complete Aadhaar, PAN or document number/);
});

test("admin overview measures push delivery from the current queue table", async () => {
  const route = await readFile(new URL("../app/api/admin/overview/route.ts", import.meta.url), "utf8");
  assert.match(route, /pim_v2\.push_delivery_queue/);
  assert.doesNotMatch(route, /pim_v2\.notification_deliveries/);
  assert.match(route, /status='DELIVERED'/);
});

test("Pandit approval decisions remain deliverable and trigger a persistent device alert", async () => {
  const [push, worker, center, route] = await Promise.all([
    readFile(new URL("../lib/push-notifications.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../components/notification-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/pandits/route.ts", import.meta.url), "utf8"),
  ]);
  for (const event of ["PANDIT_APPROVED", "PANDIT_REJECTED", "PANDIT_CHANGES_REQUESTED"]) {
    assert.match(push, new RegExp(`"${event}"`));
    assert.match(worker, new RegExp(`"${event}"`));
    assert.match(center, new RegExp(`"${event}"`));
  }
  assert.match(push, /7 \* 24 \* 60 \* 60/);
  assert.match(worker, /requireInteraction: persistentEvents\.includes/);
  assert.match(worker, /silent: false/);
  assert.match(center, /playPanditDecisionAlarm/);
  assert.match(center, /setInterval\(.*8_000/);
  assert.match(route, /eventType: `PANDIT_\$\{eventAction\}`/);
});
