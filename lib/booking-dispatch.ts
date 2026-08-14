import { sql } from "./db";
import { notifyUser } from "./push-notifications";

export const SEARCH_RADII_KM = [5, 10, 20, 40] as const;
export const OFFER_WINDOW_MINUTES = 3;

export function travelSurchargeForRadius(radiusKm: number) {
  if (radiusKm <= 5) return 0;
  if (radiusKm <= 10) return 100;
  if (radiusKm <= 20) return 250;
  return 500;
}

type DispatchBooking = {
  id: string; customer_id: string; service_id: string; request_type: string; preferred_language: string | null;
  latitude: number; longitude: number; scheduled_at: string | null; search_radius_km: number; max_search_radius_km: number;
  status: string; dispatch_status: string;
};
type Candidate = { id: string; name: string; charge: number; distance_km: string };

async function candidatesForRadius(booking: DispatchBooking, radiusKm: number) {
  return sql<Candidate>(
    `WITH candidates AS (
       SELECT u.id,u.name,ps.charge,least(COALESCE(p.service_radius_km,40),40) AS service_radius_km,
         6371*acos(least(1,greatest(-1,
           cos(radians($3))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians($4))+
           sin(radians($3))*sin(radians(p.latitude))
         ))) AS distance
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$2
       WHERE p.verification_status='APPROVED' AND ($5='SCHEDULED_PUJA' OR p.is_online=true)
         AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.user_id<>$6
         AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM unnest(p.languages) language WHERE lower(language)=lower($7)))
         AND (($8::timestamptz IS NULL AND NOT EXISTS(
           SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=p.user_id AND busy.id<>$1
             AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
         )) OR ($8::timestamptz IS NOT NULL AND NOT EXISTS(
           SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=p.user_id AND busy.id<>$1
             AND busy.scheduled_at BETWEEN $8::timestamptz-interval '3 hours' AND $8::timestamptz+interval '3 hours'
             AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
         )))
         AND NOT EXISTS(SELECT 1 FROM pim_v2.booking_offers old_offer WHERE old_offer.booking_id=$1 AND old_offer.pandit_id=p.user_id)
     )
     SELECT id,name,charge,round(distance::numeric,1)::text AS distance_km
     FROM candidates
     WHERE distance>$9 AND distance<=least(service_radius_km,$10)
     ORDER BY distance,charge
     LIMIT 8`,
    [booking.id, booking.service_id, booking.latitude, booking.longitude, booking.request_type, booking.customer_id,
      booking.preferred_language, booking.scheduled_at, booking.search_radius_km, radiusKm],
  );
}

async function offerRadius(booking: DispatchBooking, radiusKm: number) {
  const candidates = await candidatesForRadius(booking, radiusKm);
  const surcharge = travelSurchargeForRadius(radiusKm);
  const expiresAt = new Date(Date.now() + OFFER_WINDOW_MINUTES * 60_000).toISOString();
  const offered: Candidate[] = [];

  for (const candidate of candidates.rows) {
    const inserted = await sql(
      `INSERT INTO pim_v2.booking_offers(id,booking_id,pandit_id,radius_km,distance_km,service_amount,travel_surcharge,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(booking_id,pandit_id) DO NOTHING RETURNING id`,
      [crypto.randomUUID(), booking.id, candidate.id, radiusKm, candidate.distance_km, candidate.charge, surcharge, expiresAt],
    );
    if (inserted.rows[0]) offered.push(candidate);
  }

  await sql(
    `UPDATE pim_v2.bookings SET search_radius_km=$2,dispatch_status='SEARCHING',
       next_expansion_at=CASE WHEN $3>0 THEN $4::timestamptz ELSE now() END
     WHERE id=$1 AND status='REQUESTED' AND dispatch_status='SEARCHING'`,
    [booking.id, radiusKm, offered.length, expiresAt],
  );
  if (radiusKm > 5) {
    await notifyUser(booking.customer_id, {
      title: `Search expanded to ${radiusKm} km`,
      body: offered.length
        ? `We found ${offered.length} more eligible Pandit${offered.length === 1 ? "" : "s"}. Travel surcharge is capped at ₹${surcharge}.`
        : `No eligible Pandit responded inside ${radiusKm} km yet. We are continuing your approved search.`,
      url: "/customer#live-requests",
      eventType: "BOOKING_SEARCH_EXPANDED",
    });
  }
  await Promise.all(offered.map((candidate) => notifyUser(candidate.id, {
    title: booking.request_type === "SCHEDULED_PUJA" ? "Scheduled Puja needs your guidance" : "New nearby Puja offer",
    body: booking.request_type === "SCHEDULED_PUJA" && booking.scheduled_at
      ? `A Puja is requested for ${new Date(booking.scheduled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" })}. Accept if the date is suitable, then confirm the muhurat and samagri in private chat.`
      : `A matching request is ${candidate.distance_km} km away. Accept within ${OFFER_WINDOW_MINUTES} minutes if you are available.`,
    url: "/pandit#pandit-requests",
    eventType: booking.request_type === "SCHEDULED_PUJA" ? "SCHEDULED_PUJA_GUIDANCE_REQUIRED" : "BOOKING_REQUESTED",
  })));
  return offered.length;
}

export async function advanceBookingDispatch(bookingId: string) {
  const claimed = await sql<DispatchBooking>(
    `UPDATE pim_v2.bookings SET next_expansion_at=now()+interval '30 seconds'
     WHERE id=$1 AND status='REQUESTED' AND dispatch_status='SEARCHING'
       AND (next_expansion_at IS NULL OR next_expansion_at<=now())
     RETURNING id,customer_id,service_id,request_type,preferred_language,latitude,longitude,scheduled_at,
       search_radius_km,max_search_radius_km,status,dispatch_status`,
    [bookingId],
  );
  let booking = claimed.rows[0];
  if (!booking) return null;
  await sql(`UPDATE pim_v2.booking_offers SET status='EXPIRED',responded_at=now() WHERE booking_id=$1 AND status='OFFERED' AND expires_at<=now()`, [bookingId]);

  const pendingRadii = SEARCH_RADII_KM.filter((radius) => radius > booking.search_radius_km && radius <= booking.max_search_radius_km);
  for (const radius of pendingRadii) {
    const offeredCount = await offerRadius(booking, radius);
    if (offeredCount > 0) return { status: "SEARCHING" as const, radiusKm: radius, offeredCount };
    booking = { ...booking, search_radius_km: radius };
  }

  await sql(
    `UPDATE pim_v2.bookings SET status='DECLINED',dispatch_status='EXHAUSTED',next_expansion_at=NULL
     WHERE id=$1 AND status='REQUESTED' AND dispatch_status='SEARCHING'`,
    [bookingId],
  );
  await notifyUser(booking.customer_id, {
    title: "Nearby Pandits are currently busy",
    body: "We completed the approved nearby search. You can reserve the earliest visit or speak with an online Pandit.",
    url: "/customer#live-requests",
    eventType: "BOOKING_SEARCH_EXHAUSTED",
  });
  return { status: "EXHAUSTED" as const, radiusKm: booking.search_radius_km, offeredCount: 0 };
}

export async function startBookingDispatch(bookingId: string) {
  await sql(`UPDATE pim_v2.bookings SET dispatch_status='SEARCHING',search_radius_km=0,next_expansion_at=now() WHERE id=$1 AND status='REQUESTED'`, [bookingId]);
  return advanceBookingDispatch(bookingId);
}

export async function advanceDueBookingDispatches(customerId?: string) {
  const due = await sql<{ id: string }>(
    `SELECT id FROM pim_v2.bookings
     WHERE status='REQUESTED' AND dispatch_status='SEARCHING' AND next_expansion_at<=now()
       AND ($1::uuid IS NULL OR customer_id=$1)
     ORDER BY next_expansion_at LIMIT 12`,
    [customerId ?? null],
  );
  for (const booking of due.rows) await advanceBookingDispatch(booking.id);
}

export async function fallbackPlan(input: { serviceId: string; language: string; latitude: number; longitude: number; customerId: string }) {
  const counts = await sql<{ within_5: number; within_10: number; within_20: number; within_40: number }>(
    `WITH candidates AS (
       SELECT least(COALESCE(p.service_radius_km,40),40) AS service_radius_km,
         6371*acos(least(1,greatest(-1,cos(radians($3))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians($4))+sin(radians($3))*sin(radians(p.latitude))))) AS distance
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$1
       WHERE p.verification_status='APPROVED' AND p.is_online=true AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
         AND p.user_id<>$5 AND EXISTS(SELECT 1 FROM unnest(p.languages) language WHERE lower(language)=lower($2))
         AND NOT EXISTS(SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=p.user_id AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS'))
     ) SELECT
       count(*) FILTER(WHERE distance<=least(service_radius_km,5))::int AS within_5,
       count(*) FILTER(WHERE distance<=least(service_radius_km,10))::int AS within_10,
       count(*) FILTER(WHERE distance<=least(service_radius_km,20))::int AS within_20,
       count(*) FILTER(WHERE distance<=least(service_radius_km,40))::int AS within_40
     FROM candidates`,
    [input.serviceId, input.language, input.latitude, input.longitude, input.customerId],
  );
  const earliest = await sql<{ available_at: string | null }>(
    `WITH candidates AS (
       SELECT p.user_id
       FROM pim_v2.pandit_profiles p
       JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$1
       WHERE p.verification_status='APPROVED' AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.user_id<>$5
         AND EXISTS(SELECT 1 FROM unnest(p.languages) language WHERE lower(language)=lower($2))
         AND 6371*acos(least(1,greatest(-1,cos(radians($3))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians($4))+sin(radians($3))*sin(radians(p.latitude)))))<=least(COALESCE(p.service_radius_km,40),40)
     ), slots AS (
       SELECT generate_series(date_trunc('hour',now()+interval '3 hours'),date_trunc('hour',now()+interval '3 days'),interval '2 hours') AS available_at
     ) SELECT available_at FROM slots
     WHERE EXISTS(SELECT 1 FROM candidates c WHERE NOT EXISTS(
       SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=c.user_id
         AND busy.scheduled_at BETWEEN slots.available_at-interval '3 hours' AND slots.available_at+interval '3 hours'
         AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
     )) ORDER BY available_at LIMIT 1`,
    [input.serviceId, input.language, input.latitude, input.longitude, input.customerId],
  );
  const row = counts.rows[0] ?? { within_5: 0, within_10: 0, within_20: 0, within_40: 0 };
  return {
    stages: SEARCH_RADII_KM.map((radiusKm) => ({
      radiusKm,
      eligibleCount: row[`within_${radiusKm}` as keyof typeof row] ?? 0,
      travelSurcharge: travelSurchargeForRadius(radiusKm),
      etaMinutes: radiusKm <= 5 ? 25 : radiusKm <= 10 ? 40 : radiusKm <= 20 ? 70 : 130,
    })),
    earliestAvailableAt: earliest.rows[0]?.available_at ?? null,
  };
}
