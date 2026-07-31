import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type FeaturedPandit = {
  id: string;
  name: string;
  experience_years: number;
  languages: string[];
  rating: string;
  rating_count: number;
  completed_jobs: number;
  is_online: boolean;
  starting_charge: number;
  services: string[];
  total_approved: number;
  online_count: number;
};

export async function GET() {
  const result = await sql<FeaturedPandit>(
    `SELECT u.id,u.name,p.experience_years,p.languages,p.rating,p.rating_count,p.completed_jobs,p.is_online,
       min(ps.charge)::int AS starting_charge,
       array_agg(DISTINCT s.name ORDER BY s.name) AS services,
       count(*) OVER()::int AS total_approved,
       count(*) FILTER (WHERE p.is_online) OVER()::int AS online_count
     FROM pim_v2.pandit_profiles p
     JOIN pim_v2.users u ON u.id=p.user_id
     JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id
     JOIN pim_v2.services s ON s.id=ps.service_id
     WHERE p.verification_status='APPROVED'
     GROUP BY u.id,u.name,p.experience_years,p.languages,p.rating,p.rating_count,p.completed_jobs,p.is_online
     ORDER BY p.is_online DESC,p.rating_count DESC,p.rating DESC,p.completed_jobs DESC,u.name
     LIMIT 6`,
  );
  return NextResponse.json(
    {
      pandits: result.rows,
      stats: {
        approved: result.rows[0]?.total_approved ?? 0,
        online: result.rows[0]?.online_count ?? 0,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
