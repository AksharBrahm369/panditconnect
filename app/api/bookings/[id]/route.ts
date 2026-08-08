import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { verifyArrivalOtp } from "@/lib/arrival-otp";
import { cancellationFee, recordBookingEvent } from "@/lib/booking-risk";

const transitions: Record<string, string[]> = {
  REQUESTED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as { status?: string; arrivalOtp?: string; cancellationReason?: string };
  const current = await sql<{ status: string; customer_id: string; pandit_id: string; arrival_otp: string; arrival_otp_attempts: number; scheduled_at: string | null; accepted_at: string | null; amount: number; policy_version: string | null }>(
    `SELECT status,customer_id,pandit_id,arrival_otp,arrival_otp_attempts,scheduled_at,accepted_at,amount,policy_version FROM pim_v2.bookings WHERE id=$1`,
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
  if (body.status === "ON_THE_WAY" && booking.scheduled_at && new Date(booking.scheduled_at).getTime() > Date.now() + 4 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "This Puja is scheduled for later. You can start travelling up to 4 hours before the scheduled time." }, { status: 409 });
  }
  let journeyLocation:{latitude:number;longitude:number;distanceMetres?:number}|null=null;
  if(body.status==="ON_THE_WAY"||body.status==="ARRIVED"){
    const location=await sql<{latitude:number;longitude:number;distance_metres:number}>(`SELECT p.latitude,p.longitude,CASE WHEN $2='ARRIVED' THEN round(6371000*acos(least(1,greatest(-1,cos(radians(b.latitude))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians(b.longitude))+sin(radians(b.latitude))*sin(radians(p.latitude))))))::int ELSE 0 END AS distance_metres FROM pim_v2.pandit_profiles p JOIN pim_v2.bookings b ON b.id=$1 WHERE p.user_id=$3 AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.updated_at>now()-interval '2 minutes'`,[id,body.status,user.id]);
    if(!location.rows[0])return NextResponse.json({error:"Fresh GPS location is required. Allow location access and try again."},{status:409});
    journeyLocation={latitude:Number(location.rows[0].latitude),longitude:Number(location.rows[0].longitude),distanceMetres:Number(location.rows[0].distance_metres)};
    if(body.status==="ARRIVED"&&journeyLocation.distanceMetres!>1000)return NextResponse.json({error:`You are still about ${Math.round(journeyLocation.distanceMetres!/100)/10} km from the customer. Arrival can be confirmed within 1 km.`},{status:409});
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
  const cancellation = body.status === "CANCELLED"
    ? booking.policy_version
      ? cancellationFee(booking.status,booking.amount,booking.accepted_at)
      : { fee:0,stage:"NO_POLICY_EVIDENCE",free:true }
    : { fee:0,stage:"NONE",free:true };
  const updated = await sql<{ status: string }>(
    `WITH updated_booking AS (
       UPDATE pim_v2.bookings SET status=$2,
         arrival_otp_attempts=CASE WHEN $2='IN_PROGRESS' THEN 0 ELSE arrival_otp_attempts END,
         accepted_at=CASE WHEN $2='ACCEPTED' THEN now() ELSE accepted_at END,
         completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE completed_at END,
         cancellation_reason=CASE WHEN $2='CANCELLED' THEN $4 ELSE cancellation_reason END,
         cancelled_by=CASE WHEN $2='CANCELLED' THEN $5::uuid ELSE cancelled_by END,
         cancelled_at=CASE WHEN $2='CANCELLED' THEN now() ELSE cancelled_at END,
         cancellation_fee=CASE WHEN $2='CANCELLED' THEN $6 ELSE cancellation_fee END,
         cancellation_fee_status=CASE WHEN $2='CANCELLED' AND $6>0 THEN 'OUTSTANDING' WHEN $2='CANCELLED' THEN 'NONE' ELSE cancellation_fee_status END,
         arrived_at=CASE WHEN $2='ARRIVED' THEN now() ELSE arrived_at END,
         travel_started_at=CASE WHEN $2='ON_THE_WAY' THEN now() ELSE travel_started_at END,
         travel_started_latitude=CASE WHEN $2='ON_THE_WAY' THEN $7 ELSE travel_started_latitude END,
         travel_started_longitude=CASE WHEN $2='ON_THE_WAY' THEN $8 ELSE travel_started_longitude END,
         arrival_distance_metres=CASE WHEN $2='ARRIVED' THEN $9 ELSE arrival_distance_metres END,
         declined_pandit_ids=CASE
           WHEN $2='DECLINED' AND NOT (pandit_id = ANY(declined_pandit_ids))
             THEN array_append(declined_pandit_ids,pandit_id)
           ELSE declined_pandit_ids
         END
       WHERE id=$1 AND status=$3
       RETURNING status,pandit_id,customer_id,cancellation_fee
     ),
     update_pandit_total AS (
       UPDATE pim_v2.pandit_profiles p
       SET completed_jobs=p.completed_jobs+1,updated_at=now()
       FROM updated_booking b
       WHERE $2='COMPLETED' AND p.user_id=b.pandit_id
       RETURNING p.user_id
     ),
     cancellation_ledger AS (
       INSERT INTO pim_v2.account_ledger(id,user_id,booking_id,entry_type,amount,status,note)
       SELECT $10,customer_id,$1,'CANCELLATION_FEE',cancellation_fee,'OUTSTANDING',$13 FROM updated_booking
       WHERE $2='CANCELLED' AND cancellation_fee>0
       ON CONFLICT DO NOTHING
     ),
     cancellation_risk AS (
       INSERT INTO pim_v2.customer_risk_profiles(user_id,risk_points,late_cancellations,requires_prepayment,restricted_until)
       SELECT customer_id,$12,1,false,NULL FROM updated_booking WHERE $2='CANCELLED' AND cancellation_fee>0
       ON CONFLICT(user_id) DO UPDATE SET risk_points=pim_v2.customer_risk_profiles.risk_points+$12,late_cancellations=pim_v2.customer_risk_profiles.late_cancellations+1,requires_prepayment=pim_v2.customer_risk_profiles.late_cancellations+1>=3,restricted_until=CASE WHEN pim_v2.customer_risk_profiles.late_cancellations+1>=5 THEN now()+interval '7 days' ELSE pim_v2.customer_risk_profiles.restricted_until END,updated_at=now()
     ),
     pandit_compensation AS (
       INSERT INTO pim_v2.account_ledger(id,user_id,booking_id,entry_type,amount,status,note)
       SELECT $11,pandit_id,$1,'PANDIT_COMPENSATION',round(cancellation_fee*.8)::int,'PENDING','Pending cancellation-fee collection' FROM updated_booking
       WHERE $2='CANCELLED' AND cancellation_fee>0
     )
     SELECT status FROM updated_booking`,
    [id, body.status, booking.status, body.cancellationReason?.trim().slice(0,500) ?? null, user.id, cancellation.fee,journeyLocation?.latitude??null,journeyLocation?.longitude??null,journeyLocation?.distanceMetres??null,crypto.randomUUID(),crypto.randomUUID(),cancellation.stage==='PANDIT_ARRIVED'?3:2,`Late cancellation: ${cancellation.stage}`],
  );
  if (!updated.rows[0]) {
    return NextResponse.json({ error: "This request changed on another screen. Please refresh and try again." }, { status: 409 });
  }
  await recordBookingEvent({ bookingId:id,actorId:user.id,actorRole:user.role,eventType:`BOOKING_${body.status}`,fromStatus:booking.status,toStatus:body.status,metadata:{ cancellationReason:body.status==='CANCELLED'?body.cancellationReason?.trim():undefined,cancellationFee:cancellation.fee,cancellationStage:cancellation.stage,policyEvidencePresent:Boolean(booking.policy_version),journeyLocation } });
  const recipientId = user.id === booking.pandit_id ? booking.customer_id : booking.pandit_id;
  const statusCopy: Record<string, string> = { ACCEPTED: "Your Pandit accepted the request.", DECLINED: "The Pandit is unavailable. Find another nearby Pandit.", CANCELLED: user.role === "CUSTOMER" ? `The customer cancelled this Puja request. Reason: ${body.cancellationReason?.trim()}` : "The booking request was cancelled.", ON_THE_WAY: "Your Pandit is on the way.", ARRIVED: "Your Pandit has arrived. Share the arrival OTP in person.", IN_PROGRESS: "Your Puja service has started.", COMPLETED: "Your Puja is complete. Open the completed booking to choose a payment method and leave a rating." };
  await notifyUser(recipientId, { title: body.status === "CANCELLED" && user.role === "CUSTOMER" ? "Customer cancelled the Puja" : "Booking update", body: statusCopy[body.status] ?? `Booking status: ${body.status.replaceAll("_", " ")}`, url: user.role === "PANDIT" ? "/customer#live-requests" : "/pandit#cancelled-requests", eventType: `BOOKING_${body.status}` });
  return NextResponse.json({ success: true, status: updated.rows[0].status });
}
