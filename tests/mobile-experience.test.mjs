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
  assert.match(css, /prefers-reduced-motion/);
});
