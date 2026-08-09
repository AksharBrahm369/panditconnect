import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { recordSystemEvent } from "@/lib/operations";
import { enforceRateLimit,rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request:Request){try{const user=await currentUser();await enforceRateLimit(request,"client:error",user?.id,10,3_600,900);const body=await request.json() as {message?:string;digest?:string;path?:string};await recordSystemEvent({severity:"ERROR",source:"client",eventType:"CLIENT_RENDER_ERROR",message:String(body.message||"Client application error").slice(0,500),metadata:{digest:String(body.digest||"").slice(0,100),path:String(body.path||"").slice(0,300),userId:user?.id??null,role:user?.role??null}});return NextResponse.json({received:true});}catch(error){return rateLimitResponse(error)??NextResponse.json({received:false},{status:202});}}
