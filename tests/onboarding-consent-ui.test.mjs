import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Pandit rules consent keeps a compact checkbox beside readable copy", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.rules-consent\s*\{[^}]*grid-template-columns:\s*22px minmax\(0,\s*1fr\)/s);
  assert.match(css, /\.rules-consent\s*>\s*input\[type="checkbox"\]\s*\{[^}]*width:\s*20px[^}]*height:\s*20px/s);
  assert.match(css, /\.rules-consent:has\(> input:checked\)/);
});
