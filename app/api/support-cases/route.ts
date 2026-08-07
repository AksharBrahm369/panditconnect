import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyAdmins } from "@/lib/push-notifications";

export const dynamic = "force-dynamic";
const categories = new Set(["NO_SHOW","SAFETY","SERVICE_QUALITY","BOOKING","CHAT","ACCOUNT","OTHER"]);

export async function GET() {
  const user = await currentUser();
  if (!user || !["CUSTOMER","PANDIT"].includes(user.role)) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const result = await sql(`SELECT id,booking_id,consultation_id,category,subject,description,priority,status,resolution,created_at,updated_at FROM pim_v2.support_cases WHERE reporter_id=$1 ORDER BY created_at DESC LIMIT 30`, [user.id]);
  return NextResponse.json({ cases: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !["CUSTOMER","PANDIT"].includes(user.role)) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const body = await request.json() as { category?: string; subject?: string; description?: string; bookingId?: string; consultationId?: string };
  const category = body.category?.toUpperCase() ?? "";
  const subject = body.subject?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  if (!categories.has(category) || subject.length < 5 || description.length < 10) return NextResponse.json({ error: "Complete the category, subject and description." }, { status: 400 });
  if (body.bookingId) {
    const owned = await sql(`SELECT 1 FROM pim_v2.bookings WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`, [body.bookingId,user.id]);
    if (!owned.rows[0]) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (body.consultationId) {
    const owned = await sql(`SELECT 1 FROM pim_v2.consultations WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`, [body.consultationId,user.id]);
    if (!owned.rows[0]) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }
  const priority = category === "SAFETY" || category === "NO_SHOW" ? "URGENT" : "NORMAL";
  const result = await sql(`INSERT INTO pim_v2.support_cases(id,reporter_id,booking_id,consultation_id,category,subject,description,priority) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,status,priority,created_at`, [crypto.randomUUID(),user.id,body.bookingId||null,body.consultationId||null,category,subject.slice(0,120),description.slice(0,2000),priority]);
  await notifyAdmins({ title: priority === "URGENT" ? "Urgent support case" : "New support case", body: subject.slice(0,120), url: "/admin#admin-support", eventType: "SUPPORT_CASE_CREATED" });
  return NextResponse.json({ case: result.rows[0] }, { status: 201 });
}
