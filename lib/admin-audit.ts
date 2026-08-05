import { sql } from "./db";
import { requestIp, requestUserAgent } from "./request-security";

export async function recordAdminAction(request: Request, adminUserId: string, action: string, targetType: string, targetId?: string | null, metadata: Record<string, unknown> = {}) {
  await sql(
    `INSERT INTO pim_v2.admin_audit_logs(id,admin_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
    [crypto.randomUUID(), adminUserId, action, targetType, targetId ?? null, JSON.stringify(metadata), requestIp(request), requestUserAgent(request)],
  );
}
