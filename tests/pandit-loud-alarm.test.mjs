import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pandits receive repeating loud alarms for Puja and chat requests", async () => {
  const alarm = await readFile(new URL("../components/pandit-urgent-alarm.tsx", import.meta.url), "utf8");
  const portal = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  const chat = await readFile(new URL("../components/consultation-panel.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const clientPush = await readFile(new URL("../lib/client-push.ts", import.meta.url), "utf8");
  assert.match(alarm, /Enable loud alerts/);
  assert.match(alarm, /setInterval\(.*8_000/);
  assert.match(alarm, /navigator\.vibrate/);
  assert.match(alarm, /oscillator\.type = "square"/);
  assert.match(alarm, /connectDeviceToPush/);
  assert.match(alarm, /panditconnect-notification-sound/);
  assert.match(clientPush, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(clientPush, /pushManager\.subscribe/);
  assert.match(portal, /status === "REQUESTED"/);
  assert.match(portal, /chatRequests=\{urgentChatIds\.length\}/);
  assert.match(chat, /onUrgentItemsChange/);
  assert.match(worker, /CONSULTATION_STARTED/);
  assert.match(worker, /requireInteraction/);
});
