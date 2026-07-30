import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

type NearbyPandit = {
  id: string; name: string; experience_years: number; languages: string[]; rating: string;
  completed_jobs: number; charge: number; distance_km: string; eta_minutes: number;
};

type NearbyCacheEntry = { expiresAt: number; pandits: NearbyPandit[] };

declare global {
  var __pimV2NearbyCache: Map<string, NearbyCacheEntry> | undefined;
}

const nearbyCache = globalThis.__pimV2NearbyCache ?? new Map<string, NearbyCacheEntry>();
globalThis.__pimV2NearbyCache = nearbyCache;

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const serviceId = params.get("serviceId") ?? "ganesh-puja";
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lng"));
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "A valid current location is required" }, { status: 400 });
    }
    const cacheKey = `${serviceId}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    const cached = nearbyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(
        { pandits: cached.pandits },
        { headers: { "Cache-Control": "private, max-age=5" } },
      );
    }
    const result = await sql<NearbyPandit>(
      `WITH available AS (
         SELECT u.id,u.name,p.experience_years,p.languages,p.rating,p.completed_jobs,ps.charge,
           6371 * acos(least(1, greatest(-1,
             cos(radians($2)) * cos(radians(p.latitude)) *
             cos(radians(p.longitude) - radians($3)) +
             sin(radians($2)) * sin(radians(p.latitude))
           ))) AS distance
         FROM pim_v2.pandit_profiles p
         JOIN pim_v2.users u ON u.id=p.user_id
         JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$1
         WHERE p.verification_status='APPROVED' AND p.is_online=true
           AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
       )
       SELECT id,name,experience_years,languages,rating,completed_jobs,charge,
         round(distance::numeric,1)::text AS distance_km,
         greatest(10,round(distance*3)::int+8) AS eta_minutes
       FROM available
       ORDER BY distance,rating DESC LIMIT 8`,
      [serviceId, latitude, longitude],
    );
    nearbyCache.set(cacheKey, { pandits: result.rows, expiresAt: Date.now() + 10_000 });
    return NextResponse.json(
      { pandits: result.rows },
      { headers: { "Cache-Control": "private, max-age=5" } },
    );
  } catch (error) {
    console.error("Nearby Pandit lookup failed", error);
    return NextResponse.json({ error: "Unable to load nearby Pandits" }, { status: 500 });
  }
}
