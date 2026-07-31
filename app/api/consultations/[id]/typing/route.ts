import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

async function canAccess(consultationId: string, userId: string) {
  const result = await sql(
    `SELECT id FROM pim_v2.consultations
     WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`,
    [consultationId, userId],
  );
  return Boolean(result.rows[0]);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { id } = await params;
  if (!await canAccess(id, user.id)) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }
  const result = await sql<{ name: string | null; role: string }>(
    `SELECT u.name,u.role
     FROM pim_v2.consultation_typing t
     JOIN pim_v2.users u ON u.id=t.sender_id
     WHERE t.consultation_id=$1 AND t.sender_id<>$2 AND t.expires_at>now()
     LIMIT 1`,
    [id, user.id],
  );
  return NextResponse.json(
    { typing: Boolean(result.rows[0]), participant: result.rows[0] ?? null },
    { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { id } = await params;
  if (!await canAccess(id, user.id)) {
    return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
  }
  const body = await request.json() as { typing?: boolean };
  if (body.typing) {
    await sql(
      `INSERT INTO pim_v2.consultation_typing(consultation_id,sender_id,expires_at)
       VALUES($1,$2,now()+interval '4 seconds')
       ON CONFLICT(consultation_id,sender_id)
       DO UPDATE SET expires_at=excluded.expires_at`,
      [id, user.id],
    );
  } else {
    await sql(
      `DELETE FROM pim_v2.consultation_typing WHERE consultation_id=$1 AND sender_id=$2`,
      [id, user.id],
    );
  }
  return NextResponse.json({ success: true });
}
