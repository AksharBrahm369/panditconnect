import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("all app buttons share a lightweight click animation", async () => {
  const [layout, component, styles, mobile] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/button-interactions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/mobile.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<ButtonInteractions \/>/);
  assert.match(component, /document\.addEventListener\("pointerdown"/);
  assert.match(component, /event\.key === "Enter" \|\| event\.key === " "/);
  assert.match(component, /button:not\(\[disabled\]\)/);
  assert.match(styles, /@keyframes button-ripple/);
  assert.match(styles, /@keyframes button-click-pop/);
  assert.match(mobile, /prefers-reduced-motion: reduce/);
  assert.match(mobile, /\.interaction-ripple \{ display:none; \}/);
});
