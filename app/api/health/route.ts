import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { appEnvironment, productionConfigurationIssues } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql("SELECT 1 AS healthy");
    const issues = productionConfigurationIssues();
    return NextResponse.json(
      {
        status: issues.length ? "degraded" : "ok",
        database: "connected",
        configuration: issues.length ? "incomplete" : "ready",
        environment: appEnvironment(),
        timestamp: new Date().toISOString(),
      },
      { status: issues.length ? 503 : 200, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Health check failed", error);
    return NextResponse.json(
      { status: "unavailable", database: "unavailable", environment: appEnvironment(), timestamp: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
