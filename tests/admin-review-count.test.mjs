import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin dashboard and verification drawer share the live queue total", async () => {
  const portal = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  assert.match(portal, /const \[queueTotal, setQueueTotal\]/);
  assert.match(portal, /queueSummaryResponse/);
  assert.match(portal, /setQueueTotal\(Number\(result\.total/);
  assert.match(portal, /const pendingPanditCount = queueTotal \?\?/);
  assert.match(portal, /\{pendingPanditCount\} Pandit/);
  assert.match(portal, /`\$\{pendingPanditCount\} profile/);
});
