import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json() as { rating?: number; comment?: string };
  const rating = Math.floor(Number(body.rating));
  const comment = body.comment?.trim().slice(0, 500) || null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Choose a rating from 1 to 5 stars." }, { status: 400 });
  }
  const result = await sql<{ rating: string; rating_count: number }>(
    `WITH rated_booking AS (
       UPDATE pim_v2.bookings
       SET customer_rating=$3,rating_comment=$4,rated_at=now()
       WHERE id=$1 AND customer_id=$2 AND status='COMPLETED' AND customer_rating IS NULL
       RETURNING pandit_id
     ),
     updated_profile AS (
       UPDATE pim_v2.pandit_profiles p
       SET rating=(
             SELECT round(
               (COALESCE(sum(b.customer_rating),0)+$3)::numeric /
               (count(b.customer_rating)+1),
               1
             )
             FROM pim_v2.bookings b
             WHERE b.pandit_id=p.user_id AND b.customer_rating IS NOT NULL
           ),
           rating_count=(
             SELECT count(*)::int+1
             FROM pim_v2.bookings b
             WHERE b.pandit_id=p.user_id AND b.customer_rating IS NOT NULL
           ),
           updated_at=now()
       FROM rated_booking rb
       WHERE p.user_id=rb.pandit_id
       RETURNING p.rating,p.rating_count
     )
     SELECT rating,rating_count FROM updated_profile`,
    [id, user.id, rating, comment],
  );
  if (!result.rows[0]) {
    return NextResponse.json(
      { error: "Only a completed Puja can be rated, and each booking can be rated once." },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true, ...result.rows[0] });
}
