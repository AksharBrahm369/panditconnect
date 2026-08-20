import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("pandit portal presents a simple task-first mobile workflow", async () => {
  const portal = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(shell, /label: "Home"/);
  assert.match(shell, /label: "Requests"/);
  assert.match(shell, /label: "Schedule"/);
  assert.match(shell, /label: "Account"/);
  assert.match(portal, /What needs your attention/);
  assert.match(portal, /pandit-command-centre/);
  assert.match(portal, /Your current GPS location will be confirmed when you go online/);
  assert.match(portal, /pandit-job-next/);
  assert.match(portal, /I am leaving now/);
  assert.match(portal, /I have arrived/);
  assert.match(portal, /Puja is complete/);
  assert.match(portal, /Address protected/);
  assert.match(portal, /Customer&apos;s material choice/);
  assert.match(portal, /Customer already has Puja materials/);
  assert.match(portal, /You need to bring the Puja materials/);
  assert.match(portal, /Customer needs help with materials/);
  assert.match(portal, /b\.request_type === "PANDIT_SOS" && b\.status === "REQUESTED"/);
  assert.match(styles, /Pandit portal: calm, task-first workspace/);
  assert.match(styles, /Pandit workdesk v2/);
  assert.match(styles, /\.pandit-command-centre/);
  assert.match(styles, /\.pandit-presence-button/);
  assert.match(styles, /\.pandit-job-next/);
  assert.match(styles, /\.pandit-material-alert/);
  assert.match(styles, /\.pandit-decision button,.pandit-next-button,.pandit-code-step button \{ width:100%; min-height:52px/);
});
