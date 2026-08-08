import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("customer booking has a dedicated mobile-friendly Indian PIN field", async () => {
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  assert.match(customer, /6-digit PIN code/);
  assert.match(customer, /inputMode="numeric"/);
  assert.match(customer, /autoComplete="postal-code"/);
  assert.match(customer, /value=\{pinCode\}/);
  assert.match(customer, /postalCode: pinCode/);
});

test("booking API accepts a separate PIN and safely appends it to the stored address", async () => {
  const route = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  assert.match(route, /postalCode\?: string/);
  assert.match(route, /\^\[1-9\]\\d\{5\}\$/);
  assert.match(route, /PIN \$\{postalCode\}/);
  assert.match(route, /Enter a valid 6-digit Indian PIN code/);
});
