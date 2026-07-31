import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

type RematchResult = {
  name: string;
  distance_km: string;
  eta_minutes: number;
};

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Customer login required" }, { status: 401 });
  }

  const { id } = await context.params;
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const result = await sql<RematchResult>(
    `WITH marked AS (
       UPDATE pim_v2.bookings
       SET declined_pandit_ids =
         CASE WHEN pandit_id = ANY(declined_pandit_ids)
           THEN declined_pandit_ids
           ELSE array_append(declined_pandit_ids, pandit_id)
         END
       WHERE id=$1 AND customer_id=$2 AND status='DECLINED'
       RETURNING id,service_id,latitude,longitude,preferred_language,declined_pandit_ids
     ),
     matches AS (
       SELECT u.id,u.name,ps.charge,p.rating,
         6371 * acos(least(1, greatest(-1,
           cos(radians(m.latitude)) * cos(radians(p.latitude)) *
           cos(radians(p.longitude) - radians(m.longitude)) +
           sin(radians(m.latitude)) * sin(radians(p.latitude))
         ))) AS distance
       FROM marked m
       JOIN pim_v2.pandit_profiles p
         ON p.verification_status='APPROVED'
        AND p.is_online=true
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND NOT (p.user_id = ANY(m.declined_pandit_ids))
       JOIN pim_v2.users u ON u.id=p.user_id
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=m.service_id
       ORDER BY
         CASE WHEN m.preferred_language IS NULL OR m.preferred_language=ANY(p.languages) THEN 0 ELSE 1 END,
         distance,p.rating DESC
       LIMIT 1
     ),
     reassigned AS (
       UPDATE pim_v2.bookings b
       SET pandit_id=matches.id,amount=matches.charge,status='REQUESTED',
         arrival_otp=$3,accepted_at=NULL
       FROM matches
       WHERE b.id=$1
       RETURNING matches.name,matches.distance
     )
     SELECT name,round(distance::numeric,1)::text AS distance_km,
       greatest(10,round(distance*3)::int+8) AS eta_minutes
     FROM reassigned`,
    [id, user.id, otp],
  );

  const match = result.rows[0];
  if (!match) {
    const booking = await sql<{ status: string }>(
      `SELECT status FROM pim_v2.bookings WHERE id=$1 AND customer_id=$2`,
      [id, user.id],
    );
    if (!booking.rows[0]) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (booking.rows[0].status !== "DECLINED") {
      return NextResponse.json({ error: "This request is no longer waiting for a rematch" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "No other approved Pandit is online nearby right now. Please try again in a few minutes." },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    matchedPandit: {
      name: match.name,
      distanceKm: match.distance_km,
      etaMinutes: match.eta_minutes,
    },
  });
}
