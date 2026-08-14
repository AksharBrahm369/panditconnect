import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordBookingEvent } from "@/lib/booking-risk";

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
       WHERE id=$1
         AND customer_id=$2
         AND status='COMPLETED'
         AND payment_status='CONFIRMED'
         AND customer_rating IS NULL
       RETURNING pandit_id
     ),
     rating_totals AS (
       SELECT rb.pandit_id,
              round(avg(scores.rating)::numeric,1) AS rating,
              count(*)::int AS rating_count
       FROM rated_booking rb
       CROSS JOIN LATERAL (
         -- Data-modifying CTE results are not visible through a second scan of
         -- bookings in this statement, so include the newly submitted score
         -- explicitly alongside all ratings that existed before this update.
         SELECT b.customer_rating::numeric AS rating
         FROM pim_v2.bookings b
         WHERE b.pandit_id=rb.pandit_id AND b.customer_rating IS NOT NULL
         UNION ALL
         SELECT $3::numeric
       ) scores
       GROUP BY rb.pandit_id
     ),
     updated_profile AS (
       UPDATE pim_v2.pandit_profiles p
       SET rating=totals.rating,
           rating_count=totals.rating_count,
           updated_at=now()
       FROM rating_totals totals
       WHERE p.user_id=totals.pandit_id
       RETURNING p.rating,p.rating_count
     )
     SELECT rating,rating_count FROM updated_profile`,
    [id, user.id, rating, comment],
  );
  if (!result.rows[0]) {
    return NextResponse.json(
      { error: "Confirm the payment first. A completed Puja can be rated only once after payment is confirmed." },
      { status: 409 },
    );
  }
  await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:"CUSTOMER_RATING_SUBMITTED",metadata:{rating,hasComment:Boolean(comment)}});
  return NextResponse.json({ success: true, ...result.rows[0] });
}
