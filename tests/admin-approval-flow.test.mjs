import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin approval explains missing checks and saves completed evidence before approval", async () => {
  const portal = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  assert.match(portal, /Complete these checks before approval/);
  assert.match(portal, /action: "UPDATE_CHECKLIST"/);
  assert.match(portal, /Choose how the identity was verified/);
  assert.match(portal, /Choose how the bank or UPI account was verified/);
  assert.match(portal, /Never enter the complete Aadhaar, PAN or document number/);
});

test("admin overview measures push delivery from the current queue table", async () => {
  const route = await readFile(new URL("../app/api/admin/overview/route.ts", import.meta.url), "utf8");
  assert.match(route, /pim_v2\.push_delivery_queue/);
  assert.doesNotMatch(route, /pim_v2\.notification_deliveries/);
  assert.match(route, /status='DELIVERED'/);
});
