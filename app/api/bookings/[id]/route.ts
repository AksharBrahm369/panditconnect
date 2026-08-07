import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { verifyArrivalOtp } from "@/lib/arrival-otp";

const transitions: Record<string, string[]> = {
  REQUESTED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["ARRIVED"],
  ARRIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as { status?: string; arrivalOtp?: string; cancellationReason?: string };
  const current = await sql<{ status: string; customer_id: string; pandit_id: string; arrival_otp: string; arrival_otp_attempts: number }>(
    `SELECT status,customer_id,pandit_id,arrival_otp,arrival_otp_attempts FROM pim_v2.bookings WHERE id=$1`,
    [id],
  );
  const booking = current.rows[0];
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (user.id !== booking.customer_id && user.id !== booking.pandit_id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const isPanditAction = ["ACCEPTED", "DECLINED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED"].includes(body.status ?? "");
  if (isPanditAction && (user.role !== "PANDIT" || user.id !== booking.pandit_id)) {
    return NextResponse.json({ error: "Only the assigned Pandit can perform this action" }, { status: 403 });
  }
  if (body.status === "CANCELLED" && (user.role !== "CUSTOMER" || user.id !== booking.customer_id)) {
    return NextResponse.json({ error: "Only the customer can cancel this request" }, { status: 403 });
  }
  if (body.status === "CANCELLED" && (body.cancellationReason?.trim().length ?? 0) < 5) {
    return NextResponse.json({ error: "Please select or enter a cancellation reason." }, { status: 400 });
  }
  if (!body.status || !transitions[booking.status]?.includes(body.status)) {
    return NextResponse.json({ error: "This booking action is not available" }, { status: 409 });
  }
  if (body.status === "IN_PROGRESS") {
    const submittedOtp = body.arrivalOtp?.replace(/\D/g, "") ?? "";
    if (booking.arrival_otp_attempts >= 5) {
      return NextResponse.json({ error: "Too many incorrect arrival-code attempts. Contact support." }, { status: 429 });
    }
    if (!await verifyArrivalOtp(booking.arrival_otp, submittedOtp)) {
      await sql(`UPDATE pim_v2.bookings SET arrival_otp_attempts=arrival_otp_attempts+1 WHERE id=$1 AND status='ARRIVED'`, [id]);
      return NextResponse.json(
        { error: "Incorrect arrival OTP. Ask the customer for the current 6-digit code." },
        { status: 400 },
      );
    }
  }
  const updated = await sql<{ status: string }>(
    `WITH updated_booking AS (
       UPDATE pim_v2.bookings SET status=$2,
         arrival_otp_attempts=CASE WHEN $2='IN_PROGRESS' THEN 0 ELSE arrival_otp_attempts END,
         accepted_at=CASE WHEN $2='ACCEPTED' THEN now() ELSE accepted_at END,
         completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE completed_at END,
         cancellation_reason=CASE WHEN $2='CANCELLED' THEN $4 ELSE cancellation_reason END,
         cancelled_by=CASE WHEN $2='CANCELLED' THEN $5::uuid ELSE cancelled_by END,
         cancelled_at=CASE WHEN $2='CANCELLED' THEN now() ELSE cancelled_at END,
         declined_pandit_ids=CASE
           WHEN $2='DECLINED' AND NOT (pandit_id = ANY(declined_pandit_ids))
             THEN array_append(declined_pandit_ids,pandit_id)
           ELSE declined_pandit_ids
         END
       WHERE id=$1 AND status=$3
       RETURNING status,pandit_id
     ),
     update_pandit_total AS (
       UPDATE pim_v2.pandit_profiles p
       SET completed_jobs=p.completed_jobs+1,updated_at=now()
       FROM updated_booking b
       WHERE $2='COMPLETED' AND p.user_id=b.pandit_id
       RETURNING p.user_id
     )
     SELECT status FROM updated_booking`,
    [id, body.status, booking.status, body.cancellationReason?.trim().slice(0,500) ?? null, user.id],
  );
  if (!updated.rows[0]) {
    return NextResponse.json({ error: "This request changed on another screen. Please refresh and try again." }, { status: 409 });
  }
  const recipientId = user.id === booking.pandit_id ? booking.customer_id : booking.pandit_id;
  const statusCopy: Record<string, string> = { ACCEPTED: "Your Pandit accepted the request.", DECLINED: "The Pandit is unavailable. Find another nearby Pandit.", CANCELLED: "The booking request was cancelled.", ON_THE_WAY: "Your Pandit is on the way.", ARRIVED: "Your Pandit has arrived. Share the arrival OTP in person.", IN_PROGRESS: "Your Puja service has started.", COMPLETED: "Your Puja is complete. Open the completed booking to choose a payment method and leave a rating." };
  await notifyUser(recipientId, { title: "Booking update", body: statusCopy[body.status] ?? `Booking status: ${body.status.replaceAll("_", " ")}`, url: user.role === "PANDIT" ? "/customer#live-requests" : "/pandit#pandit-requests", eventType: `BOOKING_${body.status}` });
  return NextResponse.json({ success: true, status: updated.rows[0].status });
}
