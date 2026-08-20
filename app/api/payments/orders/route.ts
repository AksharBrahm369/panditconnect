import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { createProviderOrder, paymentPublicConfig } from "@/lib/payment-provider";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type PaymentPurpose = "SERVICE_PAYMENT" | "CANCELLATION_FEE" | "CONSULTATION";
type OrderRequest = {
  purpose?: PaymentPurpose;
  bookingId?: string;
  panditId?: string;
  topic?: string;
  blocks?: number;
  idempotencyKey?: string;
};

function publicOrderResponse(user: { name: string | null; email: string | null; phone: string | null }) {
  return {
    ...paymentPublicConfig(),
    prefill: { name: user.name ?? "", email: user.email ?? "", contact: user.phone ?? "" },
  };
}

export async function GET() {
  return NextResponse.json(paymentPublicConfig(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    await enforceRateLimit(request, "payment:order", user.id, 10, 3_600, 900);
    const body = await request.json() as OrderRequest;
    if (!body.idempotencyKey || body.idempotencyKey.length > 100 || !body.purpose || !["SERVICE_PAYMENT", "CANCELLATION_FEE", "CONSULTATION"].includes(body.purpose)) {
      return NextResponse.json({ error: "Invalid payment request" }, { status: 400 });
    }

    const existing = await sql<{ id: string; provider_order_id: string; status: string; amount: number; consultation_id: string | null }>(
      `SELECT id,provider_order_id,status,amount,consultation_id
       FROM pim_v2.payment_transactions
       WHERE user_id=$1 AND idempotency_key=$2`,
      [user.id, body.idempotencyKey],
    );
    if (existing.rows[0]) {
      const order = existing.rows[0];
      return NextResponse.json({ transactionId: order.id, orderId: order.provider_order_id, status: order.status, amount: order.amount, currency: "INR", consultationId: order.consultation_id, ...publicOrderResponse(user) });
    }

    if (body.purpose === "CONSULTATION") {
      if (!body.panditId) return NextResponse.json({ error: "Choose an available Pandit to begin." }, { status: 400 });
      const blocks = Math.min(6, Math.max(1, Math.floor(Number(body.blocks) || 1)));
      const topic = body.topic?.trim().slice(0, 500) || "General Puja and religious guidance";
      const pandit = await sql<{ consultation_rate_5min: number }>(
        `SELECT p.consultation_rate_5min
         FROM pim_v2.pandit_profiles p
         JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
         WHERE p.user_id=$1 AND p.user_id<>$2 AND p.verification_status='APPROVED' AND p.consultation_online=true`,
        [body.panditId, user.id],
      );
      const available = pandit.rows[0];
      if (!available) return NextResponse.json({ error: "This Pandit is no longer available for chat." }, { status: 409 });

      const consultationId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      const amount = available.consultation_rate_5min * blocks;
      const providerOrder = await createProviderOrder({ amountRupees: amount, receipt: transactionId, notes: { transactionId, consultationId, purpose: body.purpose } });
      await sql(
        `WITH consultation AS (
           INSERT INTO pim_v2.consultations(id,customer_id,pandit_id,topic,status,rate_5min,blocks,amount,payment_status,payment_method,ends_at)
           VALUES($1,$2,$3,$4,'AWAITING_PAYMENT',$5,$6,$7,'PENDING',NULL,now())
           RETURNING id
         )
         INSERT INTO pim_v2.payment_transactions(id,user_id,consultation_id,purpose,amount,provider,provider_order_id,status,idempotency_key)
         SELECT $8,$2,id,'CONSULTATION',$7,'razorpay',$9,'PENDING',$10 FROM consultation`,
        [consultationId, user.id, body.panditId, topic, available.consultation_rate_5min, blocks, amount, transactionId, providerOrder.id, body.idempotencyKey],
      );
      return NextResponse.json({ transactionId, consultationId, orderId: providerOrder.id, amount, currency: "INR", ...publicOrderResponse(user) }, { status: 201 });
    }

    if (!body.bookingId) return NextResponse.json({ error: "Booking is required" }, { status: 400 });
    const booking = await sql<{ id: string; amount: number; status: string; cancellation_fee: number; cancellation_fee_status: string; payment_status: string }>(
      `SELECT id,amount,status,cancellation_fee,cancellation_fee_status,payment_status
       FROM pim_v2.bookings WHERE id=$1 AND customer_id=$2`,
      [body.bookingId, user.id],
    );
    const current = booking.rows[0];
    if (!current) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const amount = body.purpose === "CANCELLATION_FEE" ? current.cancellation_fee : current.amount;
    if (body.purpose === "CANCELLATION_FEE" && !["OUTSTANDING", "DISPUTED"].includes(current.cancellation_fee_status)) return NextResponse.json({ error: "No payable cancellation balance exists" }, { status: 409 });
    if (body.purpose === "SERVICE_PAYMENT" && current.status !== "COMPLETED") return NextResponse.json({ error: "Service payment is available after Puja completion" }, { status: 409 });
    if (body.purpose === "SERVICE_PAYMENT" && current.payment_status === "CONFIRMED") return NextResponse.json({ error: "This Puja payment is already confirmed" }, { status: 409 });
    if (amount <= 0) return NextResponse.json({ error: "No amount is due" }, { status: 409 });

    const pending = await sql<{ id: string; provider_order_id: string; status: string }>(
      `SELECT id,provider_order_id,status
       FROM pim_v2.payment_transactions
       WHERE user_id=$1 AND booking_id=$2 AND purpose=$3 AND amount=$4 AND status IN ('PENDING','CAPTURED')
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, current.id, body.purpose, amount],
    );
    if (pending.rows[0]) {
      return NextResponse.json({ transactionId: pending.rows[0].id, orderId: pending.rows[0].provider_order_id, status: pending.rows[0].status, amount, currency: "INR", ...publicOrderResponse(user) });
    }

    const transactionId = crypto.randomUUID();
    const providerOrder = await createProviderOrder({ amountRupees: amount, receipt: transactionId, notes: { transactionId, bookingId: current.id, purpose: body.purpose } });
    await sql(
      `INSERT INTO pim_v2.payment_transactions(id,user_id,booking_id,purpose,amount,provider,provider_order_id,status,idempotency_key)
       VALUES($1,$2,$3,$4,$5,'razorpay',$6,'PENDING',$7)`,
      [transactionId, user.id, current.id, body.purpose, amount, providerOrder.id, body.idempotencyKey],
    );
    return NextResponse.json({ transactionId, orderId: providerOrder.id, amount, currency: "INR", ...publicOrderResponse(user) }, { status: 201 });
  } catch (error) {
    return authorizationResponse(error) ?? rateLimitResponse(error) ?? NextResponse.json({ error: error instanceof Error && error.message.includes("configured") ? error.message : "Unable to start payment" }, { status: 503 });
  }
}
