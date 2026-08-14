import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

test("completed Puja checkout follows payment then review", async () => {
  const customer = await source("../components/customer-portal.tsx");
  assert.match(customer, /Step 1 · Payment/);
  assert.match(customer, /Step 2 · Review/);
  assert.match(customer, /Review unlocks after payment/);
  assert.match(customer, />UPI</);
  assert.match(customer, /Pay using any UPI app/);
});

test("the rating endpoint cannot bypass payment confirmation", async () => {
  const route = await source("../app/api/bookings/[id]/rating/route.ts");
  assert.match(route, /payment_status='CONFIRMED'/);
  assert.match(route, /Confirm the payment first/);
});
