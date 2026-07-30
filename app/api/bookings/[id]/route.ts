import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const transitions: Record<string, string[]> = {
  REQUESTED: ["ACCEPTED", "DECLINED", "CANCELLED"],
  ACCEPTED: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["ARRIVED"],
  ARRIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json() as { status?: string };
  const current = await sql<{ status: string; customer_id: string; pandit_id: string }>(
    `SELECT status,customer_id,pandit_id FROM pim_v2.bookings WHERE id=$1`,
    [id],
  );
  const booking = current.rows[0];
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (user.id !== booking.customer_id && user.id !== booking.pandit_id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (!body.status || !transitions[booking.status]?.includes(body.status)) {
    return NextResponse.json({ error: "This booking action is not available" }, { status: 409 });
  }
  await sql(
    `UPDATE pim_v2.bookings SET status=$2,
      accepted_at=CASE WHEN $2='ACCEPTED' THEN now() ELSE accepted_at END,
      completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE completed_at END
     WHERE id=$1`,
    [id, body.status],
  );
  return NextResponse.json({ success: true });
}

