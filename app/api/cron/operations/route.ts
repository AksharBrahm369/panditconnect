import { NextResponse } from "next/server";
import { beginOperation, finishOperation, recordSystemEvent } from "@/lib/operations";
import { runScheduledOperations } from "@/lib/scheduled-operations";

export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request){
  const secret=process.env.CRON_SECRET?.trim();
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
  const runId=await beginOperation("scheduled-operations");
  try{const summary=await runScheduledOperations();await finishOperation(runId,"SUCCEEDED",summary);return NextResponse.json({ok:true,summary},{headers:{"Cache-Control":"no-store"}});}
  catch(error){const message=error instanceof Error?error.message:"Unknown scheduled operation failure";await finishOperation(runId,"FAILED",{message});await recordSystemEvent({severity:"CRITICAL",source:"cron/operations",eventType:"SCHEDULED_OPERATION_FAILED",message,fingerprint:"scheduled-operations"});return NextResponse.json({ok:false,error:"Scheduled operations failed"},{status:500,headers:{"Cache-Control":"no-store"}});}
}
