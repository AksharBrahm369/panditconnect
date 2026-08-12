import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin dashboard and verification drawer share the live queue total", async () => {
  const portal = await readFile(new URL("../components/admin-portal.tsx", import.meta.url), "utf8");
  assert.match(portal, /const \[queueTotal, setQueueTotal\]/);
  assert.match(portal, /const refreshQueueTotal = useCallback/);
  assert.match(portal, /setQueueTotal\(Number\(result\.total/);
  assert.match(portal, /setInterval\(\(\) => void refreshQueueTotal\(\), 30_000\)/);
  assert.match(portal, /visibilitychange/);
  assert.match(portal, /const pendingPanditCount = queueTotal \?\?/);
  assert.match(portal, /\{pendingPanditCount\} Pandit/);
  assert.match(portal, /`\$\{pendingPanditCount\} profile/);
  assert.match(portal, /Submitted applications remain in the Review queue until Admin completes verification/);
});
