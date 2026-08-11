import { NextResponse } from "next/server";
import { currentSessionUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyAdmins } from "@/lib/push-notifications";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const categories = new Set(["NO_SHOW","SAFETY","SERVICE_QUALITY","BOOKING","CHAT","ACCOUNT","PAYMENT","REFUND","PRIVACY","GRIEVANCE","OTHER"]);

export async function GET() {
  const user = await currentSessionUser();
  if (!user || !["CUSTOMER","PANDIT"].includes(user.role)) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const result = await sql(`SELECT id,booking_id,consultation_id,category,subject,description,priority,status,resolution,created_at,updated_at FROM pim_v2.support_cases WHERE reporter_id=$1 ORDER BY created_at DESC LIMIT 30`, [user.id]);
  return NextResponse.json({ cases: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
 try {
  const user = await currentSessionUser();
  if (!user || !["CUSTOMER","PANDIT"].includes(user.role)) return NextResponse.json({ error: "Login required" }, { status: 401 });
  await enforceRateLimit(request,"support:create",user.id,5,86_400,3_600);
  const body = await request.json() as { category?: string; subject?: string; description?: string; bookingId?: string; consultationId?: string };
  const category = body.category?.toUpperCase() ?? "";
  const subject = body.subject?.trim() ?? "";
  const description = body.description?.trim() ?? "";
  if (!categories.has(category) || subject.length < 5 || description.length < 10) return NextResponse.json({ error: "Complete the category, subject and description." }, { status: 400 });
  const usage = await sql<{ open_count:number; daily_count:number }>(`SELECT count(*) FILTER (WHERE status IN ('OPEN','IN_REVIEW'))::int AS open_count,count(*) FILTER (WHERE created_at>now()-interval '24 hours')::int AS daily_count FROM pim_v2.support_cases WHERE reporter_id=$1`,[user.id]);
  if((usage.rows[0]?.open_count??0)>=3)return NextResponse.json({error:"You already have 3 open support cases. Add evidence to an existing case or wait for Admin review."},{status:429});
  if((usage.rows[0]?.daily_count??0)>=5)return NextResponse.json({error:"Daily support request limit reached. For immediate safety concerns, contact local emergency services."},{status:429});
  if (body.bookingId) {
    const owned = await sql(`SELECT 1 FROM pim_v2.bookings WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`, [body.bookingId,user.id]);
    if (!owned.rows[0]) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (body.consultationId) {
    const owned = await sql(`SELECT 1 FROM pim_v2.consultations WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`, [body.consultationId,user.id]);
    if (!owned.rows[0]) return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }
  if(body.bookingId){const duplicate=await sql(`SELECT 1 FROM pim_v2.support_cases WHERE reporter_id=$1 AND booking_id=$2 AND category=$3 AND status IN ('OPEN','IN_REVIEW') LIMIT 1`,[user.id,body.bookingId,category]);if(duplicate.rows[0])return NextResponse.json({error:"An open case for this booking and issue type already exists."},{status:409});}
  const priority = category === "SAFETY" || category === "NO_SHOW" ? "URGENT" : "NORMAL";
  const result = await sql(`INSERT INTO pim_v2.support_cases(id,reporter_id,booking_id,consultation_id,category,subject,description,priority,first_response_due_at,resolution_due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+CASE WHEN $8='URGENT' THEN interval '1 hour' ELSE interval '1 day' END,now()+CASE WHEN $8='URGENT' THEN interval '1 day' ELSE interval '7 days' END) RETURNING id,status,priority,created_at,first_response_due_at,resolution_due_at`, [crypto.randomUUID(),user.id,body.bookingId||null,body.consultationId||null,category,subject.slice(0,120),description.slice(0,2000),priority]);
  await notifyAdmins({ title: priority === "URGENT" ? "Urgent support case" : "New support case", body: subject.slice(0,120), url: "/admin#admin-support", eventType: "SUPPORT_CASE_CREATED" });
  return NextResponse.json({ case: result.rows[0] }, { status: 201 });
 } catch(error){return rateLimitResponse(error)??NextResponse.json({error:"Unable to create support case"},{status:500});}
}
