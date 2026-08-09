import { createHash } from "node:crypto";
import { sql } from "./db";
import { requestIp } from "./request-security";

export class RateLimitError extends Error { constructor(public retryAfter:number){super("Too many requests");} }

function subject(value:string){return createHash("sha256").update(value).digest("hex");}

export async function enforceRateLimit(request:Request,scope:string,identity:string|undefined,limit:number,windowSeconds:number,blockSeconds=windowSeconds){
  const key=subject(`${identity||"anonymous"}|${requestIp(request)}`);
  const result=await sql<{request_count:number;blocked_until:string|null}>(
    `INSERT INTO pim_v2.api_rate_limits(scope,subject_hash,window_started_at,request_count,updated_at)
     VALUES($1,$2,now(),1,now())
     ON CONFLICT(scope,subject_hash) DO UPDATE SET
       request_count=CASE WHEN pim_v2.api_rate_limits.window_started_at<=now()-($4::int*interval '1 second') THEN 1 ELSE pim_v2.api_rate_limits.request_count+1 END,
       window_started_at=CASE WHEN pim_v2.api_rate_limits.window_started_at<=now()-($4::int*interval '1 second') THEN now() ELSE pim_v2.api_rate_limits.window_started_at END,
       blocked_until=CASE WHEN pim_v2.api_rate_limits.blocked_until>now() THEN pim_v2.api_rate_limits.blocked_until WHEN pim_v2.api_rate_limits.request_count+1>$3 THEN now()+($5::int*interval '1 second') ELSE NULL END,
       updated_at=now()
     RETURNING request_count,blocked_until`,[scope,key,limit,windowSeconds,blockSeconds]);
  const blocked=result.rows[0]?.blocked_until;
  if(blocked&&new Date(blocked).getTime()>Date.now())throw new RateLimitError(Math.max(1,Math.ceil((new Date(blocked).getTime()-Date.now())/1000)));
}

export function rateLimitResponse(error:unknown){return error instanceof RateLimitError?Response.json({error:"Too many requests. Please wait and try again."},{status:429,headers:{"Retry-After":String(error.retryAfter)}}):null;}
