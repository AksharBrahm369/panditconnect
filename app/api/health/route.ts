import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { appEnvironment, commercialLaunchIssues, productionConfigurationIssues } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql("SELECT 1 AS healthy");
    const issues = productionConfigurationIssues();
    const launchIssues=commercialLaunchIssues();
    const operations=await sql<{status:string;completed_at:string|null}>(`SELECT status,completed_at FROM pim_v2.operation_runs WHERE operation='scheduled-operations' ORDER BY started_at DESC LIMIT 1`).catch(()=>({rows:[]} as {rows:Array<{status:string;completed_at:string|null}>}));
    const latestOperation=operations.rows[0]??null;
    return NextResponse.json(
      {
        status: issues.length ? "degraded" : "ok",
        database: "connected",
        configuration: issues.length ? "incomplete" : "ready",
        environment: appEnvironment(),
        scheduledOperations:latestOperation?{status:latestOperation.status,lastCompletedAt:latestOperation.completed_at}:"not-run",
        commercialLaunch:{ready:launchIssues.length===0,blockedRequirements:launchIssues.length},
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
