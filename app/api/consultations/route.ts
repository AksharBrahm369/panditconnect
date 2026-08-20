import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { paymentsEnabled } from "@/lib/payments";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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
     WHERE c.${column}=$1 AND c.status<>'AWAITING_PAYMENT'
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
  try { await enforceRateLimit(request,"consultation:create",user.id,10,3_600,900); } catch(error) { return rateLimitResponse(error)!; }
  await request.text().catch(() => "");
  return NextResponse.json({ error: "Start a paid consultation through secure Razorpay checkout." }, { status: 409 });
}
