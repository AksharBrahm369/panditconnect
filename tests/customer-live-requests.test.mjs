import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer live requests prioritise current status, next action and safe arrival verification", async () => {
  const portal = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../app/mobile.css", import.meta.url), "utf8");

  assert.match(portal, /See the latest update and what you need to do next/);
  assert.match(portal, /bookingStatusCopy/);
  assert.match(portal, /Track Pandit on map/);
  assert.match(portal, /\["ACCEPTED", "ON_THE_WAY", "ARRIVED"\]\.includes\(booking\.status\)/);
  assert.match(portal, /Payment recorded/);
  assert.match(portal, /booking\.status === "ARRIVED"/);
  assert.doesNotMatch(portal, /!\["REQUESTED", "DECLINED", "CANCELLED"\]\.includes\(booking\.status\).*arrival-code/);
  assert.match(portal, /Arrival code is protected/);
  assert.match(styles, /\.booking-current-state/);
  assert.match(styles, /\.tracking-facts/);
  assert.match(styles, /\.tracking-card\.status-completed/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(mobile, /\.portal-customer \.tracking-price small \{ display:none; \}/);
  assert.match(mobile, /\.portal-customer \.tracking-facts \{ grid-template-columns:minmax\(0,1fr\); \}/);
});
