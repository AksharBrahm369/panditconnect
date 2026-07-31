import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await sql(
    `SELECT id,name,description,base_price,duration_minutes
     FROM pim_v2.services
     WHERE active=true
     ORDER BY base_price,name`,
  );
  return NextResponse.json(
    { services: result.rows },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
