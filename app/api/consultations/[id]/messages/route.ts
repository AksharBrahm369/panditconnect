import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function authorized(consultationId: string, userId: string) {
  const result = await sql<{ status: string; ends_at: string; customer_id: string; pandit_id: string }>(
    `SELECT status,ends_at,customer_id,pandit_id FROM pim_v2.consultations
     WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`,
    [consultationId, userId],
  );
  return result.rows[0];
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { id } = await params;
  const consultation = await authorized(id, user.id);
  if (!consultation) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  const messages = await sql(
    `SELECT m.id,m.body,m.created_at,m.sender_id,u.name AS sender_name,u.role AS sender_role
     FROM pim_v2.consultation_messages m
     JOIN pim_v2.users u ON u.id=m.sender_id
     WHERE m.consultation_id=$1 ORDER BY m.created_at`,
    [id],
  );
  return NextResponse.json(
    { userId: user.id, consultation, messages: messages.rows },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  try { await enforceRateLimit(request,"chat:message",user.id,60,60,300); } catch(error) { return rateLimitResponse(error)!; }
  const { id } = await params;
  const consultation = await authorized(id, user.id);
  if (!consultation) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  if (consultation.status !== "ACTIVE" || new Date(consultation.ends_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This consultation has ended. Start another five-minute block to continue." }, { status: 409 });
  }
  const body = await request.json() as { message?: string };
  const message = body.message?.trim().slice(0, 1200) ?? "";
  if (!message) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  const result = await sql(
    `INSERT INTO pim_v2.consultation_messages(id,consultation_id,sender_id,body)
     VALUES($1,$2,$3,$4) RETURNING id,body,created_at,sender_id`,
    [crypto.randomUUID(), id, user.id, message],
  );
  const recipientId = user.id === consultation.customer_id ? consultation.pandit_id : consultation.customer_id;
  await notifyUser(recipientId, { title: "New guidance message", body: `${user.name ?? (user.role === "PANDIT" ? "Pandit" : "Customer")}: ${message.slice(0, 100)}`, url: user.role === "PANDIT" ? "/customer#online-guidance" : "/pandit#online-guidance", eventType: "CHAT_MESSAGE" });
  return NextResponse.json({ message: result.rows[0] });
}
