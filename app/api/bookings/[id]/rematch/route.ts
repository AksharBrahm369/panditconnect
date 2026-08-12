import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { encryptArrivalOtp } from "@/lib/arrival-otp";
import { notifyUser } from "@/lib/push-notifications";

type RematchResult = {
  id: string;
  name: string;
  distance_km: string;
  eta_minutes: number;
  status: string;
};

const privateResponse = <T,>(body: T, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: { ...init?.headers, "Cache-Control": "private, no-store, max-age=0, must-revalidate", Vary: "Cookie" },
  });

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.role !== "CUSTOMER") {
    return privateResponse({ error: "Customer login required" }, { status: 401 });
  }

  const { id } = await context.params;
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const result = await sql<RematchResult>(
    `WITH original AS (
       SELECT id,customer_id,service_id,latitude,longitude,preferred_language,pandit_id,request_type,scheduled_at,
         CASE WHEN pandit_id IS NULL THEN COALESCE(declined_pandit_ids,ARRAY[]::uuid[])
           WHEN pandit_id = ANY(COALESCE(declined_pandit_ids,ARRAY[]::uuid[]))
           THEN COALESCE(declined_pandit_ids,ARRAY[]::uuid[])
           ELSE array_append(COALESCE(declined_pandit_ids,ARRAY[]::uuid[]),pandit_id)
         END AS excluded_pandit_ids
       FROM pim_v2.bookings
       WHERE id=$1 AND customer_id=$2 AND status='DECLINED'
       FOR UPDATE
     ),
     matches AS (
       SELECT u.id,u.name,ps.charge,p.rating,least(COALESCE(p.service_radius_km,25),25) AS service_radius_km,
         6371 * acos(least(1, greatest(-1,
           cos(radians(o.latitude)) * cos(radians(p.latitude)) *
           cos(radians(p.longitude) - radians(o.longitude)) +
           sin(radians(o.latitude)) * sin(radians(p.latitude))
         ))) AS distance
       FROM original o
       JOIN pim_v2.pandit_profiles p
         ON p.verification_status='APPROVED'
        AND (o.request_type='SCHEDULED_PUJA' OR p.is_online=true)
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
        AND p.user_id<>o.customer_id
        AND NOT (p.user_id = ANY(o.excluded_pandit_ids))
        AND (o.preferred_language IS NULL OR EXISTS (
          SELECT 1 FROM unnest(p.languages) listed_language
          WHERE lower(listed_language)=lower(o.preferred_language)
        ))
        AND ((o.scheduled_at IS NULL AND NOT EXISTS (
          SELECT 1 FROM pim_v2.bookings busy
          WHERE busy.pandit_id=p.user_id AND busy.id<>o.id
            AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
        )) OR (o.scheduled_at IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM pim_v2.bookings busy
          WHERE busy.pandit_id=p.user_id AND busy.id<>o.id
            AND busy.scheduled_at BETWEEN o.scheduled_at - interval '3 hours' AND o.scheduled_at + interval '3 hours'
            AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
        )))
       JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=o.service_id
       WHERE 6371 * acos(least(1, greatest(-1,
         cos(radians(o.latitude)) * cos(radians(p.latitude)) *
         cos(radians(p.longitude) - radians(o.longitude)) +
         sin(radians(o.latitude)) * sin(radians(p.latitude))
       ))) <= least(COALESCE(p.service_radius_km,25),25)
       ORDER BY distance,p.rating DESC
       LIMIT 1
     ),
     reassigned AS (
       UPDATE pim_v2.bookings b
       SET pandit_id=matches.id,amount=matches.charge,status='REQUESTED',
         arrival_otp=$3,arrival_otp_attempts=0,accepted_at=NULL,completed_at=NULL,
         payment_method=NULL,payment_status='NOT_SELECTED',payment_confirmed_at=NULL,
         cancellation_reason=NULL,cancelled_by=NULL,cancelled_at=NULL,
         declined_pandit_ids=original.excluded_pandit_ids,
         dispatch_status='ASSIGNED',next_expansion_at=NULL,travel_surcharge=0
       FROM matches,original
       WHERE b.id=original.id AND b.status='DECLINED'
       RETURNING matches.id,matches.name,matches.distance,b.status
     )
     SELECT id,name,round(distance::numeric,1)::text AS distance_km,status,
       greatest(10,round(distance*3)::int+8) AS eta_minutes
     FROM reassigned`,
    [id, user.id, await encryptArrivalOtp(otp)],
  );

  const match = result.rows[0];
  if (!match) {
    const booking = await sql<{ status: string }>(
      `SELECT status FROM pim_v2.bookings WHERE id=$1 AND customer_id=$2`,
      [id, user.id],
    );
    if (!booking.rows[0]) {
      return privateResponse({ error: "Request not found" }, { status: 404 });
    }
    if (booking.rows[0].status !== "DECLINED") {
      return privateResponse({ error: "This request is no longer waiting for a rematch" }, { status: 409 });
    }
    return privateResponse(
      { error: "No other approved Pandit is online nearby right now. Please try again in a few minutes." },
      { status: 409 },
    );
  }

  await notifyUser(match.id, { title: "New urgent Puja request", body: "A nearby customer selected you as a replacement Pandit.", url: "/pandit#pandit-requests", eventType: "BOOKING_REQUESTED" });

  return privateResponse({
    success: true,
    matchedPandit: {
      id: match.id,
      name: match.name,
      distanceKm: match.distance_km,
      etaMinutes: match.eta_minutes,
      status: match.status,
    },
  });
}
