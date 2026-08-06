import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { paymentsEnabled } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user || !["CUSTOMER", "PANDIT"].includes(user.role)) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }
  const column = user.role === "CUSTOMER" ? "customer_id" : "pandit_id";
  const result = await sql(
    `SELECT c.id,c.topic,c.status,c.rate_5min,c.blocks,c.amount,c.payment_status,c.payment_method,
       c.started_at,c.ends_at,
       CASE WHEN $2='CUSTOMER' THEN pu.name ELSE cu.name END AS participant_name
     FROM pim_v2.consultations c
     JOIN pim_v2.users cu ON cu.id=c.customer_id
     JOIN pim_v2.users pu ON pu.id=c.pandit_id
     WHERE c.${column}=$1
     ORDER BY c.started_at DESC LIMIT 20`,
    [user.id, user.role],
  );
  return NextResponse.json(
    { userId: user.id, consultations: result.rows, paymentsEnabled: paymentsEnabled() },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }
  const body = await request.json() as { panditId?: string; topic?: string; blocks?: number; paymentMethod?: string };
  const topic = body.topic?.trim().slice(0, 500) || "General Puja and religious guidance";
  const blocks = Math.min(6, Math.max(1, Math.floor(Number(body.blocks) || 1)));
  if (!body.panditId) {
    return NextResponse.json({ error: "Choose an available Pandit to begin." }, { status: 400 });
  }
  const paymentMethod = body.paymentMethod?.trim().toUpperCase() ?? "";
  if (["UPI", "CARD"].includes(paymentMethod)) {
    return NextResponse.json({ error: `${paymentMethod} payment will be available after the secure payment gateway is configured.` }, { status: 409 });
  }
  if (paymentMethod !== "CASH") {
    return NextResponse.json({ error: "Choose a payment method before starting the chat." }, { status: 400 });
  }
  const pandit = await sql<{ consultation_rate_5min: number }>(
    `SELECT consultation_rate_5min FROM pim_v2.pandit_profiles
     WHERE user_id=$1 AND verification_status='APPROVED' AND consultation_online=true`,
    [body.panditId],
  );
  const available = pandit.rows[0];
  if (!available) return NextResponse.json({ error: "This Pandit is no longer available for chat." }, { status: 409 });
  const id = crypto.randomUUID();
  const billingEnabled = paymentsEnabled();
  const amount = available.consultation_rate_5min * blocks;
  const paymentStatus = "CASH_SELECTED";
  const result = await sql(
    `INSERT INTO pim_v2.consultations(
       id,customer_id,pandit_id,topic,rate_5min,blocks,amount,payment_status,payment_method,ends_at
     ) VALUES($1,$2,$3,$4,$5,$6::int,$7,$8,$9,now()+($6::int*interval '5 minutes'))
     RETURNING id,topic,status,rate_5min,blocks,amount,payment_status,payment_method,started_at,ends_at`,
    [id, user.id, body.panditId, topic, available.consultation_rate_5min, blocks, amount, paymentStatus, paymentMethod],
  );
  return NextResponse.json({ consultation: result.rows[0], paymentsEnabled: billingEnabled });
}
