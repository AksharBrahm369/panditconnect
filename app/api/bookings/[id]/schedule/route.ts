import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { recordBookingEvent } from "@/lib/booking-risk";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type BookingSchedule = {
  id: string;
  customer_id: string;
  pandit_id: string;
  service_name: string;
  scheduled_at: string;
  status: string;
};

function privateJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") return privateJson({ error: "Customer login required" }, 401);
  try { await enforceRateLimit(request, "booking:reschedule", user.id, 6, 3_600, 900); }
  catch (error) { return rateLimitResponse(error) ?? privateJson({ error: "Too many date changes. Please try again later." }, 429); }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { scheduledAt?: string };
  const nextDate = new Date(body.scheduledAt ?? "");
  const nextTime = nextDate.getTime();
  if (!Number.isFinite(nextTime)) return privateJson({ error: "Choose a valid Puja date and time." }, 400);
  if (nextTime < Date.now() + 2 * 60 * 60 * 1000) return privateJson({ error: "Choose a time at least 2 hours from now." }, 400);
  if (nextTime > Date.now() + 180 * 24 * 60 * 60 * 1000) return privateJson({ error: "Choose a date within the next 180 days." }, 400);

  const current = await sql<BookingSchedule>(
    `SELECT b.id,b.customer_id,b.pandit_id,b.scheduled_at,b.status,s.name AS service_name
     FROM pim_v2.bookings b JOIN pim_v2.services s ON s.id=b.service_id
     WHERE b.id=$1 AND b.customer_id=$2 AND b.request_type='SCHEDULED_PUJA'`,
    [id, user.id],
  );
  const booking = current.rows[0];
  if (!booking) return privateJson({ error: "This scheduled Puja was not found." }, 404);
  if (booking.status !== "ACCEPTED") return privateJson({ error: "The date can be changed only after the Pandit accepts and before travel starts." }, 409);
  if (Math.abs(new Date(booking.scheduled_at).getTime() - nextTime) < 60_000) return privateJson({ error: "Choose a different date or time before updating." }, 400);

  const conflict = await sql<{ customer_conflict: boolean; pandit_conflict: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM pim_v2.bookings other WHERE other.id<>$1 AND other.customer_id=$2
         AND other.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
         AND (other.scheduled_at IS NULL OR other.scheduled_at BETWEEN $4::timestamptz-interval '3 hours' AND $4::timestamptz+interval '3 hours')) AS customer_conflict,
       EXISTS(SELECT 1 FROM pim_v2.bookings other WHERE other.id<>$1 AND other.pandit_id=$3
         AND other.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
         AND (other.scheduled_at IS NULL OR other.scheduled_at BETWEEN $4::timestamptz-interval '3 hours' AND $4::timestamptz+interval '3 hours')) AS pandit_conflict`,
    [id, booking.customer_id, booking.pandit_id, nextDate.toISOString()],
  );
  if (conflict.rows[0]?.customer_conflict) return privateJson({ error: "You already have another active booking around this time." }, 409);
  if (conflict.rows[0]?.pandit_conflict) return privateJson({ error: "Your Pandit is already booked around this time. Ask for another suitable date in chat." }, 409);

  const changed = await sql<{ scheduled_at: string }>(
    `WITH locked AS (
       SELECT pg_advisory_xact_lock(hashtext($2::text)),pg_advisory_xact_lock(hashtext($4::text))
     )
     UPDATE pim_v2.bookings booking SET scheduled_at=$3,reminder_sent_at=NULL FROM locked
     WHERE booking.id=$1 AND booking.customer_id=$2 AND booking.pandit_id=$4
       AND booking.status='ACCEPTED' AND booking.request_type='SCHEDULED_PUJA'
       AND NOT EXISTS(SELECT 1 FROM pim_v2.bookings other WHERE other.id<>booking.id
         AND (other.customer_id=booking.customer_id OR other.pandit_id=booking.pandit_id)
         AND other.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
         AND (other.scheduled_at IS NULL OR other.scheduled_at BETWEEN $3::timestamptz-interval '3 hours' AND $3::timestamptz+interval '3 hours'))
     RETURNING scheduled_at`,
    [id, user.id, nextDate.toISOString(), booking.pandit_id],
  );
  if (!changed.rows[0]) return privateJson({ error: "The booking changed while you were editing it. Refresh and try again." }, 409);

  const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }).format(nextDate);
  await recordBookingEvent({
    bookingId: id,
    actorId: user.id,
    actorRole: user.role,
    eventType: "BOOKING_SCHEDULE_UPDATED",
    fromStatus: booking.status,
    toStatus: booking.status,
    metadata: { previousScheduledAt: booking.scheduled_at, scheduledAt: changed.rows[0].scheduled_at },
  });
  await notifyUser(booking.pandit_id, {
    title: "Customer updated the Puja date",
    body: `${booking.service_name} is now scheduled for ${when}. Please recheck the muhurat, samagri, chat and your calendar.`,
    url: `/pandit/schedule#scheduled-booking-${id}`,
    eventType: "BOOKING_SCHEDULE_UPDATED",
  });

  return privateJson({ success: true, scheduledAt: changed.rows[0].scheduled_at });
}
