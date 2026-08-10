import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared consultation chat follows the newest message for both roles", async () => {
  const source = await readFile(new URL("../components/consultation-panel.tsx", import.meta.url), "utf8");

  assert.match(source, /const messageListRef = useRef<HTMLDivElement \| null>\(null\)/);
  assert.match(source, /const newestMessageId = messages\.at\(-1\)\?\.id/);
  assert.match(source, /messageList\.scrollTo\(\{/);
  assert.match(source, /top: messageList\.scrollHeight/);
  assert.match(source, /behavior: isCurrentChat \? "smooth" : "auto"/);
  assert.match(source, /ref=\{messageListRef\}/);
  assert.match(source, /aria-live="polite"/);
});
