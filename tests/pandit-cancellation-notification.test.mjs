import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("customer cancellation notifies the assigned Pandit and remains visible", async () => {
  const transition = await readFile(new URL("../app/api/bookings/[id]/route.ts", import.meta.url), "utf8");
  const bookings = await readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8");
  const history = await readFile(new URL("../components/pandit-history.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(transition, /Customer cancelled the Puja/);
  assert.match(transition, /Reason:/);
  assert.match(transition, /BOOKING_\$\{body\.status\}/);
  assert.match(bookings, /b\.cancellation_reason,b\.cancelled_at/);
  assert.match(history, /"CANCELLED"/);
  assert.match(history, /HistoryBooking/);
  assert.match(worker, /BOOKING_CANCELLED/);
});
