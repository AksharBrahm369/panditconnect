import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await sql(
      `SELECT id,name,description,base_price,duration_minutes
       FROM pim_v2.services
       WHERE active=true AND id<>'religious-guidance'
       ORDER BY base_price,name`,
    );
    return NextResponse.json({ services: result.rows }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Unable to load services", error);
    return NextResponse.json({ error: "The service is temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
