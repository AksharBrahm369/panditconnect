import { NextResponse } from "next/server";
import { forgetUserSessionCache, requireUser,SESSION_COOKIE } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";
import { notifyAdmins } from "@/lib/push-notifications";

export async function GET(){try{const user=await requireUser();const result=await sql(`SELECT id,request_type,status,details,resolution,requested_at,completed_at FROM pim_v2.data_rights_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 30`,[user.id]);return NextResponse.json({requests:result.rows},{headers:{"Cache-Control":"private,no-store"}});}catch(error){return authorizationResponse(error)??NextResponse.json({error:"Unable to load privacy requests"},{status:500});}}

export async function POST(request:Request){
  try{
    const user=await requireUser();const body=await request.json() as {requestType?:string;details?:string};const requestType=body.requestType?.toUpperCase();
    if(!requestType||!["ACCOUNT_DELETION","DOCUMENT_DELETION","CONSENT_WITHDRAWAL"].includes(requestType))return NextResponse.json({error:"Invalid privacy request"},{status:400});
    if(requestType==="DOCUMENT_DELETION"&&user.role!=="PANDIT")return NextResponse.json({error:"Document deletion applies to Pandit verification documents"},{status:400});
    if(requestType==="ACCOUNT_DELETION"){
      const blockers=await sql<{active:number;balance:number}>(`SELECT (SELECT count(*)::int FROM pim_v2.bookings WHERE (customer_id=$1 OR pandit_id=$1) AND status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')) AS active,(SELECT COALESCE(sum(amount),0)::int FROM pim_v2.account_ledger WHERE user_id=$1 AND status IN ('OUTSTANDING','DISPUTED')) AS balance`,[user.id]);
      if((blockers.rows[0]?.active??0)>0)return NextResponse.json({error:"Complete or cancel active bookings before requesting account deletion."},{status:409});
      if((blockers.rows[0]?.balance??0)>0)return NextResponse.json({error:"Resolve the outstanding balance or dispute before requesting deletion."},{status:409});
    }
    if(requestType==="CONSENT_WITHDRAWAL"){
      await sql(`INSERT INTO pim_v2.notification_preferences(user_id,marketing) VALUES($1,false) ON CONFLICT(user_id) DO UPDATE SET marketing=false,updated_at=now()`,[user.id]);
      await sql(`INSERT INTO pim_v2.user_consents(id,user_id,consent_type,revoked_at,metadata) VALUES($1,$2,'OPTIONAL_MARKETING',now(),'{"source":"self_service"}'::jsonb)`,[crypto.randomUUID(),user.id]);
    }
    const result=await sql(`INSERT INTO pim_v2.data_rights_requests(id,user_id,request_type,details) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,request_type) WHERE status IN ('OPEN','IN_REVIEW') DO UPDATE SET details=EXCLUDED.details RETURNING id,status,requested_at`,[crypto.randomUUID(),user.id,requestType,body.details?.trim().slice(0,1000)||null]);
    if(requestType==="ACCOUNT_DELETION")await sql(`UPDATE pim_v2.users SET account_status='DELETION_REQUESTED' WHERE id=$1`,[user.id]);
    await notifyAdmins({title:"Privacy rights request",body:`A ${user.role.toLowerCase()} submitted a ${requestType.toLowerCase().replaceAll("_"," ")} request.`,url:"/admin#admin-privacy",eventType:"PRIVACY_REQUEST_CREATED"});
    const response=NextResponse.json({request:result.rows[0]},{status:201});
    if(requestType==="ACCOUNT_DELETION"){await sql(`DELETE FROM pim_v2.sessions WHERE user_id=$1`,[user.id]);forgetUserSessionCache(user.id);response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,sameSite:"lax",secure:true,path:"/",expires:new Date(0)});}
    return response;
  }catch(error){return authorizationResponse(error)??NextResponse.json({error:"Unable to create privacy request"},{status:500});}
}
