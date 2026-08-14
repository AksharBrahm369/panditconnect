import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("accepted customers can privately chat with and call only their assigned Pandit", async () => {
  const customer = await readFile(new URL("../components/customer-portal.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/bookings/[id]/messages/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../db/migrations/0033_booking_chat.sql", import.meta.url), "utf8");
  assert.match(customer, /pandit_phone/);
  assert.match(customer, /<BookingChat/);
  assert.match(customer, /\["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"\]/);
  assert.match(route, /participantAllowed/);
  assert.match(route, /writableStatuses/);
  assert.match(route, /BOOKING_CHAT_MESSAGE/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pim_v2\.booking_messages/);
});

test("the assigned Pandit can answer the same booking chat", async () => {
  const pandit = await readFile(new URL("../components/pandit-portal.tsx", import.meta.url), "utf8");
  const chat = await readFile(new URL("../components/booking-chat.tsx", import.meta.url), "utf8");
  assert.match(pandit, /<BookingChat/);
  assert.match(chat, /Open private chat/);
  assert.match(chat, /scrollTo/);
  assert.match(chat, /href=\{`tel:\$\{cleanPhone\}`\}/);
});

