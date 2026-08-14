import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type CalendarBooking = {
  id: string;
  service_name: string;
  scheduled_at: string;
  duration_minutes: number;
  address: string;
  customer_id: string;
  pandit_id: string;
};

function calendarDate(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function calendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || (user.role !== "PANDIT" && user.role !== "CUSTOMER")) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const result = await sql<CalendarBooking>(
    `SELECT b.id,s.name AS service_name,b.scheduled_at,s.duration_minutes,b.address,b.customer_id,b.pandit_id
     FROM pim_v2.bookings b
     JOIN pim_v2.services s ON s.id=b.service_id
     WHERE b.id=$1 AND b.request_type='SCHEDULED_PUJA'
       AND (($2='CUSTOMER' AND b.customer_id=$3) OR ($2='PANDIT' AND b.pandit_id=$3))
       AND b.scheduled_at IS NOT NULL AND b.status IN ('ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')`,
    [id, user.role, user.id],
  );
  const booking = result.rows[0];
  if (!booking) return new Response("Calendar event unavailable", { status: 404 });

  const startsAt = new Date(booking.scheduled_at);
  const endsAt = new Date(startsAt.getTime() + Math.max(30, booking.duration_minutes || 120) * 60_000);
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PanditConnect//Scheduled Puja//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.id}@panditconnect.in`,
    `DTSTAMP:${calendarDate(new Date())}`,
    `DTSTART:${calendarDate(startsAt)}`,
    `DTEND:${calendarDate(endsAt)}`,
    `SUMMARY:${calendarText(`${booking.service_name} - PanditConnect`)}`,
    `LOCATION:${calendarText(booking.address)}`,
    `DESCRIPTION:${calendarText(user.role === "PANDIT" ? "Open PanditConnect before the Puja to recheck the confirmed muhurat, samagri, customer chat and travel plan." : "Open PanditConnect before the Puja to review the confirmed time, samagri guidance and Pandit chat.")}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Scheduled Puja tomorrow - review muhurat and samagri",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Scheduled Puja begins in two hours",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(calendar, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="panditconnect-${booking.id}.ics"`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
  });
}
