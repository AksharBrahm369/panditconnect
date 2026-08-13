import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the complete app has a final mobile-first layout authority", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/mobile.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /import "\.\/mobile\.css"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.portal-mobile-nav/);
  assert.match(css, /\.settings-workspace/);
  assert.match(css, /\.review-drawer/);
  assert.match(css, /\.notification-panel/);
  assert.match(css, /\.chat-composer/);
  assert.match(css, /\.customer-welcome-copy \{ order:1/);
  assert.match(css, /\.customer-welcome-image \{ order:2/);
  assert.match(css, /\.auth-side \{ display:none/);
  assert.match(css, /\.nearby-pandit-head \{ grid-template-columns/);
  assert.match(css, /\.payment-method-grid \{ grid-template-columns/);
  assert.match(css, /prefers-reduced-motion/);
});

test("homepage nearby matching sends every required filter and reports real location errors", async () => {
  const source = await readFile(new URL("../components/live-availability-card.tsx", import.meta.url), "utf8");
  assert.match(source, /language: "Hindi"/);
  assert.match(source, /data\.error \|\| "Nearby availability could not be checked/);
  assert.match(source, /Your location worked/);
  assert.match(source, /site-settings icon/);
  assert.match(source, /pandits\.map\(\(nearbyPandit\)/);
  assert.doesNotMatch(source, /pandits\?\.\[0\]/);
});
