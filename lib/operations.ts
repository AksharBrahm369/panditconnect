import { sql } from "./db";

type Severity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export async function recordSystemEvent(input: { severity: Severity; source: string; eventType: string; message: string; metadata?: Record<string,unknown>; fingerprint?: string }) {
  const event = {
    id: crypto.randomUUID(),
    severity: input.severity,
    source: input.source.slice(0,120),
    eventType: input.eventType.slice(0,120),
    message: input.message.slice(0,1000),
    metadata: input.metadata ?? {},
    fingerprint: input.fingerprint?.slice(0,200) ?? null,
  };
  await sql(
    `INSERT INTO pim_v2.system_events(id,severity,source,event_type,message,metadata,fingerprint)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [event.id,event.severity,event.source,event.eventType,event.message,JSON.stringify(event.metadata),event.fingerprint],
  );

  const webhook = process.env.OPERATIONS_ALERT_WEBHOOK?.trim();
  if (webhook && (input.severity === "ERROR" || input.severity === "CRITICAL")) {
    await fetch(webhook, {
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({text:`[${input.severity}] ${event.source}: ${event.message}`,eventType:event.eventType,timestamp:new Date().toISOString()}),
      signal:AbortSignal.timeout(5_000),
    }).catch(() => undefined);
  }
  return event.id;
}

export async function beginOperation(operation: string) {
  const id = crypto.randomUUID();
  await sql(`INSERT INTO pim_v2.operation_runs(id,operation,status) VALUES($1,$2,'RUNNING')`,[id,operation]);
  return id;
}

export async function finishOperation(id: string, status: "SUCCEEDED" | "FAILED", summary: Record<string,unknown>) {
  await sql(`UPDATE pim_v2.operation_runs SET status=$2,summary=$3::jsonb,completed_at=now() WHERE id=$1`,[id,status,JSON.stringify(summary)]);
}
