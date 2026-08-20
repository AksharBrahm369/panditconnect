import { sql } from "./db";
import { notifyUser } from "./push-notifications";

export type CapturedPaymentResult = {
  transaction_id: string;
  user_id: string;
  booking_id: string | null;
  consultation_id: string | null;
  purpose: "SERVICE_PAYMENT" | "CANCELLATION_FEE" | "CONSULTATION";
  pandit_id: string | null;
};

export function providerPaymentMethod(method: string): "UPI" | "CARD" {
  return method.toLowerCase() === "card" ? "CARD" : "UPI";
}

export async function finalizeCapturedPayment(input: {
  orderId: string;
  paymentId: string;
  amountPaise: number;
  currency: string;
  method: string;
  checkoutSignature?: string | null;
}) {
  const method = providerPaymentMethod(input.method);
  const result = await sql<CapturedPaymentResult>(
    `WITH captured AS (
       UPDATE pim_v2.payment_transactions
       SET provider_payment_id=$2,
           provider_signature=COALESCE($3,provider_signature),
           status='CAPTURED',captured_at=now(),updated_at=now()
       WHERE provider_order_id=$1
         AND amount*100=$4
         AND currency=$5
         AND status IN ('CREATED','PENDING')
       RETURNING id AS transaction_id,user_id,booking_id,consultation_id,purpose
     ), service_booking AS (
       UPDATE pim_v2.bookings b
       SET payment_method=$6,payment_status='CONFIRMED',payment_confirmed_at=now()
       FROM captured c
       WHERE b.id=c.booking_id AND c.purpose='SERVICE_PAYMENT'
     ), cancellation_booking AS (
       UPDATE pim_v2.bookings b
       SET cancellation_fee_status='PAID'
       FROM captured c
       WHERE b.id=c.booking_id AND c.purpose='CANCELLATION_FEE'
     ), cancellation_fee AS (
       UPDATE pim_v2.account_ledger l
       SET status='PAID',settled_at=now()
       FROM captured c
       WHERE l.booking_id=c.booking_id AND c.purpose='CANCELLATION_FEE' AND l.entry_type='CANCELLATION_FEE'
     ), pandit_compensation AS (
       UPDATE pim_v2.account_ledger l
       SET status='PENDING'
       FROM captured c
       WHERE l.booking_id=c.booking_id AND c.purpose='CANCELLATION_FEE' AND l.entry_type='PANDIT_COMPENSATION'
     ), consultation AS (
       UPDATE pim_v2.consultations con
       SET status='ACTIVE',payment_status='CAPTURED',payment_method=$6,
           started_at=now(),ends_at=now()+(con.blocks*interval '5 minutes')
       FROM captured c
       WHERE con.id=c.consultation_id AND c.purpose='CONSULTATION' AND con.status='AWAITING_PAYMENT'
       RETURNING con.id,con.pandit_id
     )
     SELECT c.transaction_id,c.user_id,c.booking_id,c.consultation_id,c.purpose,
            (SELECT pandit_id FROM consultation LIMIT 1) AS pandit_id
     FROM captured c`,
    [input.orderId, input.paymentId, input.checkoutSignature ?? null, input.amountPaise, input.currency, method],
  );

  const captured = result.rows[0] ?? null;
  if (!captured) return null;

  const notifications: Promise<unknown>[] = [
    notifyUser(captured.user_id, {
      title: "Payment confirmed",
      body: captured.purpose === "CONSULTATION"
        ? "Your secure payment is confirmed. The private Pandit chat is ready."
        : "Your payment was securely confirmed.",
      url: captured.purpose === "CONSULTATION" ? "/customer#online-guidance" : "/customer#live-requests",
      eventType: "PAYMENT_CAPTURED",
    }),
  ];
  if (captured.purpose === "CONSULTATION" && captured.pandit_id) {
    notifications.push(notifyUser(captured.pandit_id, {
      title: "New paid guidance request",
      body: "A customer completed payment and is ready for a private live chat.",
      url: "/pandit#online-guidance",
      eventType: "CONSULTATION_STARTED",
    }));
  }
  await Promise.allSettled(notifications);
  return captured;
}

export async function markPaymentFailed(orderId: string, code?: string | null, description?: string | null) {
  await sql(
    `WITH failed AS (
       UPDATE pim_v2.payment_transactions
       SET status='FAILED',failure_code=$2,failure_description=$3,updated_at=now()
       WHERE provider_order_id=$1 AND status<>'CAPTURED'
       RETURNING consultation_id
     )
     UPDATE pim_v2.consultations c
     SET status='CANCELLED',completed_at=now()
     WHERE c.id IN (SELECT consultation_id FROM failed WHERE consultation_id IS NOT NULL)
       AND c.status='AWAITING_PAYMENT'`,
    [orderId, code ?? null, description ?? null],
  );
}
