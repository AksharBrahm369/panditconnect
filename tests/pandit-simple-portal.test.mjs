import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("pandit portal presents a simple task-first mobile workflow", async () => {
  const portal = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  const shell = await readFile(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(shell, /label: "Today"/);
  assert.match(shell, /label: "Requests"/);
  assert.match(shell, /label: "Chat"/);
  assert.match(portal, /Today&apos;s work/);
  assert.match(portal, /What needs your attention/);
  assert.match(portal, /I am leaving now/);
  assert.match(portal, /I have arrived/);
  assert.match(portal, /Puja is complete/);
  assert.match(portal, /Address protected/);
  assert.match(styles, /Pandit portal: calm, task-first workspace/);
  assert.match(styles, /\.portal-pandit \.pandit-today-card/);
  assert.match(styles, /\.portal-pandit \.request-card \.btn \{ min-height:54px/);
});
