import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { recordBookingEvent } from "@/lib/booking-risk";

const availableMethods = new Set(["CASH"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (user.role !== "CUSTOMER" && user.role !== "PANDIT") return NextResponse.json({ error: "Customer or Pandit login required" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json() as { method?: string; action?: "CONFIRM_RECEIVED" | "DISPUTE" };
  const booking = await sql<{ customer_id:string;pandit_id:string;status:string;payment_method:string|null;payment_status:string }>(`SELECT customer_id,pandit_id,status,payment_method,payment_status FROM pim_v2.bookings WHERE id=$1`,[id]);
  const current = booking.rows[0];
  if (!current || (user.id!==current.customer_id && user.id!==current.pandit_id)) return NextResponse.json({error:"Booking not found"},{status:404});
  if (current.status!=="COMPLETED") return NextResponse.json({error:"Payment can be confirmed only after the Puja is completed."},{status:409});
  if (body.action === "DISPUTE") {
    await sql(`UPDATE pim_v2.bookings SET payment_status='DISPUTED',payment_disputed_at=now() WHERE id=$1`,[id]);
    await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:"PAYMENT_DISPUTED",metadata:{method:current.payment_method}});
    await notifyUser(user.id===current.customer_id?current.pandit_id:current.customer_id,{title:"Cash payment disputed",body:"The other participant reported a disagreement about cash payment. Please open support.",url:user.role==="CUSTOMER"?"/pandit#completed-pujas":"/customer#live-requests",eventType:"BOOKING_PAYMENT_DISPUTED"});
    return NextResponse.json({success:true,paymentStatus:"DISPUTED"});
  }
  if (body.action === "CONFIRM_RECEIVED") {
    if (user.role!=="PANDIT" || user.id!==current.pandit_id || current.payment_method!=="CASH") return NextResponse.json({error:"Only the assigned Pandit can confirm receiving selected cash payment."},{status:403});
    const result=await sql<{payment_status:string}>(`UPDATE pim_v2.bookings SET pandit_cash_confirmed_at=now(),payment_status=CASE WHEN customer_cash_confirmed_at IS NOT NULL THEN 'CONFIRMED' ELSE 'AWAITING_PANDIT' END,payment_confirmed_at=CASE WHEN customer_cash_confirmed_at IS NOT NULL THEN now() ELSE payment_confirmed_at END WHERE id=$1 RETURNING payment_status`,[id]);
    await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:"PANDIT_CONFIRMED_CASH",metadata:{paymentStatus:result.rows[0].payment_status}});
    await notifyUser(current.customer_id,{title:"Pandit confirmed cash received",body:"Cash payment is now confirmed by both sides.",url:"/customer#live-requests",eventType:"BOOKING_PAYMENT_CONFIRMED"});
    return NextResponse.json({success:true,paymentStatus:result.rows[0].payment_status});
  }
  if (user.role!=="CUSTOMER" || user.id!==current.customer_id) return NextResponse.json({error:"Only the customer can select the payment method."},{status:403});
  const method = body.method?.toUpperCase() ?? "";
  if (["UPI", "CARD"].includes(method)) {
    return NextResponse.json({ error: `${method} payment will be available after the secure payment gateway is configured.` }, { status: 409 });
  }
  if (!availableMethods.has(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });
  }
  const result = await sql<{ pandit_id: string; payment_method: string; payment_status: string }>(
    `UPDATE pim_v2.bookings
     SET payment_method=$3,payment_status='AWAITING_PANDIT',customer_cash_confirmed_at=now(),payment_confirmed_at=NULL
     WHERE id=$1 AND customer_id=$2 AND status='COMPLETED'
     RETURNING pandit_id,payment_method,payment_status`,
    [id, user.id, method],
  );
  const payment = result.rows[0];
  if (!payment) {
    return NextResponse.json({ error: "Payment method can be confirmed only after the Puja is completed." }, { status: 409 });
  }
  await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:"CUSTOMER_SELECTED_PAYMENT",metadata:{method,paymentStatus:payment.payment_status}});
  await notifyUser(payment.pandit_id, {
    title: "Customer selected cash payment",
    body: "Confirm in your portal only after you actually receive the cash.",
    url: "/pandit#completed-pujas",
    eventType: "BOOKING_PAYMENT_CONFIRMED",
  });
  return NextResponse.json({ success: true, paymentMethod: payment.payment_method, paymentStatus: payment.payment_status });
}
