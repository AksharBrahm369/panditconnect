import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";

const offlineMethods = new Set(["CASH", "OTHER"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json() as { method?: string };
  const method = body.method?.toUpperCase() ?? "";
  if (["UPI", "CARD"].includes(method)) {
    return NextResponse.json({ error: `${method} payment will be available after the secure payment gateway is configured.` }, { status: 409 });
  }
  if (!offlineMethods.has(method)) {
    return NextResponse.json({ error: "Choose a valid payment method." }, { status: 400 });
  }
  const result = await sql<{ pandit_id: string; payment_method: string; payment_status: string }>(
    `UPDATE pim_v2.bookings
     SET payment_method=$3,payment_status='CONFIRMED',payment_confirmed_at=now()
     WHERE id=$1 AND customer_id=$2 AND status='COMPLETED'
     RETURNING pandit_id,payment_method,payment_status`,
    [id, user.id, method],
  );
  const payment = result.rows[0];
  if (!payment) {
    return NextResponse.json({ error: "Payment method can be confirmed only after the Puja is completed." }, { status: 409 });
  }
  await notifyUser(payment.pandit_id, {
    title: "Payment method confirmed",
    body: method === "CASH" ? "The customer confirmed cash payment for the completed Puja." : "The customer confirmed an offline payment arrangement.",
    url: "/pandit#completed-pujas",
    eventType: "BOOKING_PAYMENT_CONFIRMED",
  });
  return NextResponse.json({ success: true, paymentMethod: payment.payment_method, paymentStatus: payment.payment_status });
}
