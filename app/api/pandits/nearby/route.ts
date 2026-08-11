import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type NearbyPandit = {
  id: string; name: string; experience_years: number; languages: string[]; rating: string;
  rating_count: number; completed_jobs: number; charge: number; distance_km: string; eta_minutes: number;
  service_radius_km: number;
  total_count: number;
};

type NearbyCacheEntry = { expiresAt: number; pandits: NearbyPandit[]; total: number; hasMore: boolean; page: number; limit: number };

declare global {
  var __pimV2NearbyCache: Map<string, NearbyCacheEntry> | undefined;
}

const nearbyCache = globalThis.__pimV2NearbyCache ?? new Map<string, NearbyCacheEntry>();
globalThis.__pimV2NearbyCache = nearbyCache;

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request,"pandits:nearby",undefined,120,3_600,600);
    const params = new URL(request.url).searchParams;
    const serviceId = params.get("serviceId") ?? "ganesh-puja";
    const language = params.get("language")?.trim();
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lng"));
    const scheduled = params.get("bookingMode") === "SCHEDULED";
    const scheduledAt = scheduled ? new Date(params.get("scheduledAt") ?? "") : null;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(12, Math.max(4, Number.parseInt(params.get("limit") ?? "8", 10) || 8));
    const offset = (page - 1) * limit;
    const requestedPanditId = /^[0-9a-f-]{36}$/i.test(params.get("panditId") ?? "") ? params.get("panditId") : null;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "A valid current location is required" }, { status: 400 });
    }
    if (!language || !["Hindi", "Marathi", "Gujarati", "English", "Sanskrit"].includes(language)) {
      return NextResponse.json({ error: "Choose a supported preferred language" }, { status: 400 });
    }
    if (scheduled && (!scheduledAt || !Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 2 * 60 * 60 * 1000 || scheduledAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Choose a valid Puja time at least 2 hours ahead" }, { status: 400 });
    }
    const cacheKey = `${serviceId}:${language.toLowerCase()}:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${scheduled ? scheduledAt!.toISOString() : "urgent"}:${requestedPanditId ?? "any"}:${page}:${limit}`;
    const cached = nearbyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { pandits: cached.pandits, total: cached.total, hasMore: cached.hasMore, page: cached.page, limit: cached.limit },
        { headers: { "Cache-Control": "private, max-age=5" } },
      );
    }
    const result = await sql<NearbyPandit>(
      `WITH available AS (
         SELECT u.id,u.name,p.experience_years,p.languages,p.rating,p.rating_count,p.completed_jobs,ps.charge,
           least(COALESCE(p.service_radius_km,25),25) AS service_radius_km,
           6371 * acos(least(1, greatest(-1,
             cos(radians($2)) * cos(radians(p.latitude)) *
             cos(radians(p.longitude) - radians($3)) +
             sin(radians($2)) * sin(radians(p.latitude))
           ))) AS distance
         FROM pim_v2.pandit_profiles p
         JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
         JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$1
         WHERE p.verification_status='APPROVED' AND ($5::boolean OR p.is_online=true)
           AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
           AND EXISTS (SELECT 1 FROM unnest(p.languages) listed_language WHERE lower(listed_language)=lower($4))
           AND (NOT $5::boolean OR NOT EXISTS (
             SELECT 1 FROM pim_v2.bookings busy
             WHERE busy.pandit_id=p.user_id
               AND busy.scheduled_at BETWEEN $6::timestamptz - interval '3 hours' AND $6::timestamptz + interval '3 hours'
               AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')
           ))
       )
       SELECT id,name,experience_years,languages,rating,rating_count,completed_jobs,charge,service_radius_km,
         round(distance::numeric,1)::text AS distance_km,
         greatest(10,round(distance*3)::int+8) AS eta_minutes,
         count(*) OVER()::int AS total_count
       FROM available
       WHERE distance <= service_radius_km
       ORDER BY CASE WHEN id=$7 THEN 0 ELSE 1 END,distance,rating DESC
       LIMIT $8 OFFSET $9`,
      [serviceId, latitude, longitude, language, scheduled, scheduledAt?.toISOString() ?? null, requestedPanditId, limit, offset],
    );
    const total = Number(result.rows[0]?.total_count ?? 0);
    const hasMore = offset + result.rows.length < total;
    nearbyCache.set(cacheKey, { pandits: result.rows, total, hasMore, page, limit, expiresAt: Date.now() + 10_000 });
    return NextResponse.json(
      { pandits: result.rows, total, hasMore, page, limit },
      { headers: { "Cache-Control": "private, max-age=5" } },
    );
  } catch (error) {
    const limited=rateLimitResponse(error);if(limited)return limited;
    console.error("Nearby Pandit lookup failed", error);
    return NextResponse.json({ error: "Unable to load nearby Pandits" }, { status: 500 });
  }
}
