import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { recordSystemEvent } from "@/lib/operations";
import { captureProviderPayment, fetchProviderPayment, verifyProviderWebhook } from "@/lib/payment-provider";
import { finalizeCapturedPayment, markPaymentFailed } from "@/lib/payment-processing";

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; method?: string; error_code?: string; error_description?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string; error_description?: string } };
  };
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyProviderWebhook(raw, request.headers.get("x-razorpay-signature"))) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  let event: RazorpayEvent;
  try {
    event = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const eventId = request.headers.get("x-razorpay-event-id") || payloadHash;
  const inserted = await sql(
    `INSERT INTO pim_v2.payment_webhook_events(provider,event_id,event_type,payload_hash)
     VALUES('razorpay',$1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id`,
    [eventId, event.event || "unknown", payloadHash],
  );
  if (!inserted.rows[0]) {
    const previous = await sql<{ payload_hash: string; processed_at: Date | null }>(
      `SELECT payload_hash,processed_at FROM pim_v2.payment_webhook_events
       WHERE provider='razorpay' AND event_id=$1`,
      [eventId],
    );
    if (!previous.rows[0] || previous.rows[0].payload_hash !== payloadHash) {
      return NextResponse.json({ error: "Webhook event id was reused with a different payload" }, { status: 409 });
    }
    if (previous.rows[0].processed_at) return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const payment = event.payload?.payment?.entity;
    if (event.event === "payment.authorized" && payment?.order_id && payment.id && payment.amount && payment.currency && payment.method) {
      let capturedPayment;
      try {
        capturedPayment = await captureProviderPayment(payment.id, payment.amount, payment.currency);
      } catch {
        capturedPayment = await fetchProviderPayment(payment.id);
      }
      if (capturedPayment.status !== "captured") throw new Error("Authorized payment could not be captured");
      const captured = await finalizeCapturedPayment({ orderId: payment.order_id, paymentId: capturedPayment.id, amountPaise: capturedPayment.amount, currency: capturedPayment.currency, method: capturedPayment.method });
      if (!captured) {
        const existing = await sql<{ status: string }>(`SELECT status FROM pim_v2.payment_transactions WHERE provider_order_id=$1`, [payment.order_id]);
        if (existing.rows[0]?.status !== "CAPTURED") throw new Error("Captured provider payment did not match a pending local order");
      }
    }
    if (event.event === "payment.captured" && payment?.order_id && payment.id && payment.amount && payment.currency && payment.method) {
      const captured = await finalizeCapturedPayment({ orderId: payment.order_id, paymentId: payment.id, amountPaise: payment.amount, currency: payment.currency, method: payment.method });
      if (!captured) {
        const existing = await sql<{ status: string }>(`SELECT status FROM pim_v2.payment_transactions WHERE provider_order_id=$1`, [payment.order_id]);
        if (existing.rows[0]?.status !== "CAPTURED") throw new Error("Captured provider payment did not match a pending local order");
      }
    }
    if (event.event === "payment.failed" && payment?.order_id) {
      await markPaymentFailed(payment.order_id, payment.error_code, payment.error_description);
    }

    const refund = event.payload?.refund?.entity;
    if (event.event === "refund.processed" && refund?.id) {
      await sql(
        `WITH completed AS (
           UPDATE pim_v2.refunds
           SET status='COMPLETED',completed_at=now(),updated_at=now()
           WHERE provider_refund_id=$1
           RETURNING payment_transaction_id
         ), totals AS (
           SELECT t.id,t.amount,COALESCE(sum(r.amount) FILTER (WHERE r.status='COMPLETED'),0)::int AS refunded
           FROM pim_v2.payment_transactions t
           JOIN completed c ON c.payment_transaction_id=t.id
           LEFT JOIN pim_v2.refunds r ON r.payment_transaction_id=t.id
           GROUP BY t.id,t.amount
         )
         UPDATE pim_v2.payment_transactions t
         SET status=CASE WHEN totals.refunded>=totals.amount THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END,updated_at=now()
         FROM totals WHERE t.id=totals.id`,
        [refund.id],
      );
    }
    if (event.event === "refund.failed" && refund?.id) {
      await sql(
        `WITH failed AS (
           UPDATE pim_v2.refunds SET status='FAILED',failure_reason=$2,updated_at=now()
           WHERE provider_refund_id=$1 RETURNING payment_transaction_id
         )
         UPDATE pim_v2.payment_transactions SET status='CAPTURED',updated_at=now()
         WHERE id IN (SELECT payment_transaction_id FROM failed) AND status='REFUND_PENDING'`,
        [refund.id, refund.error_description ?? "Provider refund failed"],
      );
    }

    await sql(`UPDATE pim_v2.payment_webhook_events SET processed_at=now(),processing_error=NULL WHERE provider='razorpay' AND event_id=$1`, [eventId]);
    return NextResponse.json({ received: true });
  } catch (error) {
    await sql(
      `UPDATE pim_v2.payment_webhook_events SET processing_error=$2 WHERE provider='razorpay' AND event_id=$1`,
      [eventId, error instanceof Error ? error.message : "unknown"],
    );
    await recordSystemEvent({ severity: "ERROR", source: "payments", eventType: "PAYMENT_WEBHOOK_FAILED", message: "A verified payment webhook could not be processed", metadata: { eventId, eventType: event.event } });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
