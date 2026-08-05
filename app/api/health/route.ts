import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { appEnvironment, productionConfigurationIssues } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (productionConfigurationIssues().length) throw new Error("Configuration check failed");
    await sql("SELECT 1 AS healthy");
    return NextResponse.json(
      { status: "ok", database: "connected", environment: appEnvironment(), timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      { status: "unavailable", database: "unavailable", environment: appEnvironment(), timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
