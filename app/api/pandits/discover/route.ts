import { NextResponse } from "next/server";
import { AuthorizationError, requireCustomer } from "@/lib/auth";
import { sql } from "@/lib/db";

type DiscoveryPandit = {
  id: string; name: string; city: string | null; experience_years: number; languages: string[];
  specialities: string[]; rating: string; rating_count: number; completed_jobs: number;
  starting_charge: number; distance_km: string; eta_minutes: number; services: string[];
  total_count: number;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireCustomer();
    const params = new URL(request.url).searchParams;
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lng"));
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(12, Math.max(4, Number.parseInt(params.get("limit") ?? "6", 10) || 6));
    const offset = (page - 1) * limit;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Allow location access to see genuinely nearby Pandits." }, { status: 400 });
    }

    const result = await sql<DiscoveryPandit>(
      `WITH profiles AS (
         SELECT u.id,u.name,u.city,p.experience_years,p.languages,p.specialities,p.rating,p.rating_count,
           p.completed_jobs,least(COALESCE(p.service_radius_km,25),25) AS service_radius_km,
           6371 * acos(least(1,greatest(-1,
             cos(radians($1))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians($2))+
             sin(radians($1))*sin(radians(p.latitude))
           ))) AS distance
         FROM pim_v2.pandit_profiles p
         JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
         WHERE p.verification_status='APPROVED' AND p.is_online=true
           AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
       )
       SELECT p.id,p.name,p.city,p.experience_years,p.languages,p.specialities,p.rating,p.rating_count,
         p.completed_jobs,min(ps.charge)::int AS starting_charge,
         round(p.distance::numeric,1)::text AS distance_km,
         greatest(10,round(p.distance*3)::int+8) AS eta_minutes,
         array_agg(DISTINCT s.name ORDER BY s.name) AS services,
         count(*) OVER()::int AS total_count
       FROM profiles p
       JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.id
       JOIN pim_v2.services s ON s.id=ps.service_id
       WHERE p.distance <= p.service_radius_km
       GROUP BY p.id,p.name,p.city,p.experience_years,p.languages,p.specialities,p.rating,p.rating_count,
         p.completed_jobs,p.distance
       ORDER BY p.distance,p.rating DESC,p.rating_count DESC
       LIMIT $3 OFFSET $4`,
      [latitude, longitude, limit, offset],
    );
    const total = Number(result.rows[0]?.total_count ?? 0);
    return NextResponse.json(
      { pandits: result.rows, page, limit, total, hasMore: offset + result.rows.length < total },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Pandit discovery failed", error);
    return NextResponse.json({ error: "Nearby Pandits could not be loaded right now." }, { status: 500 });
  }
}
