import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { captureProviderPayment, fetchProviderPayment, verifyCheckoutSignature } from "@/lib/payment-provider";
import { finalizeCapturedPayment, markPaymentFailed } from "@/lib/payment-processing";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type VerificationRequest = {
  transactionId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCustomer();
    await enforceRateLimit(request, "payment:verify", user.id, 20, 3_600, 300);
    const body = await request.json() as VerificationRequest;
    if (!body.transactionId || !body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature || body.razorpay_signature.length > 256) {
      return NextResponse.json({ error: "Payment verification details are incomplete." }, { status: 400 });
    }

    const transaction = await sql<{ id: string; provider_order_id: string; consultation_id: string | null; status: string; amount: number; currency: string }>(
      `SELECT id,provider_order_id,consultation_id,status,amount,currency
       FROM pim_v2.payment_transactions WHERE id=$1 AND user_id=$2`,
      [body.transactionId, user.id],
    );
    const current = transaction.rows[0];
    if (!current || current.provider_order_id !== body.razorpay_order_id) return NextResponse.json({ error: "Payment order could not be verified." }, { status: 404 });
    if (!verifyCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 401 });
    }

    let providerPayment = await fetchProviderPayment(body.razorpay_payment_id);
    if (providerPayment.order_id !== current.provider_order_id || providerPayment.amount !== current.amount * 100 || providerPayment.currency !== current.currency) {
      return NextResponse.json({ error: "Payment details did not match the order." }, { status: 409 });
    }
    if (["failed", "refunded"].includes(providerPayment.status)) {
      await markPaymentFailed(current.provider_order_id, providerPayment.status, "Provider reported an unsuccessful payment");
      return NextResponse.json({ error: "The payment was not completed." }, { status: 409 });
    }

    if (providerPayment.status === "authorized") {
      providerPayment = await captureProviderPayment(providerPayment.id, providerPayment.amount, providerPayment.currency);
    }
    if (providerPayment.status === "captured") {
      await finalizeCapturedPayment({
        orderId: current.provider_order_id,
        paymentId: providerPayment.id,
        amountPaise: providerPayment.amount,
        currency: providerPayment.currency,
        method: providerPayment.method,
        checkoutSignature: body.razorpay_signature,
      });
    } else {
      await sql(
        `UPDATE pim_v2.payment_transactions
         SET provider_payment_id=$2,provider_signature=$3,updated_at=now()
         WHERE id=$1 AND status='PENDING'`,
        [current.id, providerPayment.id, body.razorpay_signature],
      );
    }

    const verified = await sql<{ status: string; consultation_id: string | null }>(
      `SELECT status,consultation_id FROM pim_v2.payment_transactions WHERE id=$1 AND user_id=$2`,
      [current.id, user.id],
    );
    const paymentStatus = verified.rows[0]?.status ?? "PENDING";
    let consultation = null;
    if (paymentStatus === "CAPTURED" && verified.rows[0]?.consultation_id) {
      const loaded = await sql(
        `SELECT c.id,c.topic,c.status,c.rate_5min,c.blocks,c.amount,c.payment_status,c.payment_method,c.started_at,c.ends_at,u.name AS participant_name
         FROM pim_v2.consultations c JOIN pim_v2.users u ON u.id=c.pandit_id
         WHERE c.id=$1 AND c.customer_id=$2 AND c.status='ACTIVE'`,
        [verified.rows[0].consultation_id, user.id],
      );
      consultation = loaded.rows[0] ?? null;
    }
    return NextResponse.json({ success: paymentStatus === "CAPTURED", status: paymentStatus, consultation });
  } catch (error) {
    return authorizationResponse(error) ?? rateLimitResponse(error) ?? NextResponse.json({ error: "Unable to verify the payment. If money was deducted, it will be reconciled automatically." }, { status: 503 });
  }
}
