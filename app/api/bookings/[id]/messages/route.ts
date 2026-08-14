import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type BookingAccess = {
  customer_id: string;
  pandit_id: string | null;
  status: string;
  service_name: string;
};

const readableStatuses = new Set(["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED"]);
const writableStatuses = new Set(["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"]);

async function bookingAccess(id: string) {
  const result = await sql<BookingAccess>(
    `SELECT b.customer_id,b.pandit_id,b.status,s.name AS service_name
     FROM pim_v2.bookings b
     JOIN pim_v2.services s ON s.id=b.service_id
     WHERE b.id=$1`,
    [id],
  );
  return result.rows[0] ?? null;
}

function participantAllowed(booking: BookingAccess, userId: string) {
  return userId === booking.customer_id || userId === booking.pandit_id;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { id } = await context.params;
  const booking = await bookingAccess(id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!participantAllowed(booking, user.id)) return NextResponse.json({ error: "This chat is private to the assigned customer and Pandit" }, { status: 403 });
  if (!booking.pandit_id || !readableStatuses.has(booking.status)) return NextResponse.json({ error: "Chat opens after the Pandit accepts" }, { status: 409 });

  const messages = await sql(
    `SELECT m.id,m.sender_id,m.body,m.created_at,u.name AS sender_name,u.role AS sender_role
     FROM pim_v2.booking_messages m
     JOIN pim_v2.users u ON u.id=m.sender_id
     WHERE m.booking_id=$1
     ORDER BY m.created_at ASC
     LIMIT 200`,
    [id],
  );
  return NextResponse.json(
    { userId: user.id, bookingStatus: booking.status, messages: messages.rows },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  try {
    await enforceRateLimit(request, "booking-chat:message", user.id, 60, 60, 300);
  } catch (error) {
    return rateLimitResponse(error)!;
  }
  const { id } = await context.params;
  const booking = await bookingAccess(id);
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!participantAllowed(booking, user.id)) return NextResponse.json({ error: "This chat is private to the assigned customer and Pandit" }, { status: 403 });
  if (!booking.pandit_id || !writableStatuses.has(booking.status)) return NextResponse.json({ error: "Messages can be sent only while the accepted booking is active" }, { status: 409 });

  const payload = await request.json().catch(() => ({})) as { message?: unknown };
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message || message.length > 1000) return NextResponse.json({ error: "Write a message between 1 and 1000 characters" }, { status: 400 });

  const inserted = await sql(
    `INSERT INTO pim_v2.booking_messages(id,booking_id,sender_id,body)
     VALUES($1,$2,$3,$4)
     RETURNING id,sender_id,body,created_at`,
    [crypto.randomUUID(), id, user.id, message],
  );
  const recipientId = user.id === booking.customer_id ? booking.pandit_id : booking.customer_id;
  if (recipientId) {
    await notifyUser(recipientId, {
      title: `New message about ${booking.service_name}`,
      body: `${user.name ?? (user.role === "CUSTOMER" ? "Customer" : "Pandit")}: ${message.slice(0, 120)}`,
      url: user.role === "CUSTOMER" ? `/pandit#pandit-job-${id}` : `/customer#booking-${id}`,
      eventType: "BOOKING_CHAT_MESSAGE",
    });
  }
  return NextResponse.json({ message: inserted.rows[0] }, { status: 201 });
}

