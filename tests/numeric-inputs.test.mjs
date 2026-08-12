import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("number fields accept direct typing without browser stepper arrows", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /input\[type="number"\]\s*\{[^}]*appearance:\s*textfield/s);
  assert.match(css, /::-webkit-outer-spin-button/);
  assert.match(css, /::-webkit-inner-spin-button/);
  assert.match(css, /-webkit-appearance:\s*none/);
});
