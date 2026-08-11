import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { encryptArrivalOtp } from "@/lib/arrival-otp";
import { fallbackPlan, startBookingDispatch } from "@/lib/booking-dispatch";
import { recordBookingEvent } from "@/lib/booking-risk";
import { sql } from "@/lib/db";
import { enforceRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type RequestContext = { service_id:string; preferred_language:string; latitude:number; longitude:number };

async function contextForRequest(request:Request,userId:string) {
  const params=new URL(request.url).searchParams;
  const bookingId=params.get("bookingId");
  if(bookingId){
    const booking=await sql<RequestContext>(`SELECT service_id,preferred_language,latitude,longitude FROM pim_v2.bookings WHERE id=$1 AND customer_id=$2`,[bookingId,userId]);
    return booking.rows[0]??null;
  }
  const latitude=Number(params.get("lat"));const longitude=Number(params.get("lng"));
  const serviceId=params.get("serviceId")?.trim();const language=params.get("language")?.trim();
  if(!serviceId||!language||!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  return {service_id:serviceId,preferred_language:language,latitude,longitude};
}

export async function GET(request:Request){
  const user=await currentUser();
  if(!user||user.role!=="CUSTOMER")return NextResponse.json({error:"Customer login required"},{status:401});
  try{await enforceRateLimit(request,"booking:fallback-plan",user.id,80,3_600,300);}catch(error){return rateLimitResponse(error)!;}
  const context=await contextForRequest(request,user.id);
  if(!context)return NextResponse.json({error:"Complete the Puja, language and GPS location first"},{status:400});
  const plan=await fallbackPlan({serviceId:context.service_id,language:context.preferred_language,latitude:Number(context.latitude),longitude:Number(context.longitude),customerId:user.id});
  return NextResponse.json(plan,{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request){
  const user=await currentUser();
  if(!user||user.role!=="CUSTOMER")return NextResponse.json({error:"Customer login required"},{status:401});
  try{await enforceRateLimit(request,"booking:reserve-earliest",user.id,10,3_600,900);}catch(error){return rateLimitResponse(error)!;}
  const body=await request.json() as {bookingId?:string;action?:"RESERVE_EARLIEST"};
  if(!body.bookingId||body.action!=="RESERVE_EARLIEST")return NextResponse.json({error:"Choose the earliest available visit"},{status:400});
  const booking=await sql<RequestContext & {id:string}>(
    `SELECT id,service_id,preferred_language,latitude,longitude FROM pim_v2.bookings
     WHERE id=$1 AND customer_id=$2 AND status='DECLINED' AND dispatch_status='EXHAUSTED'`,
    [body.bookingId,user.id],
  );
  const original=booking.rows[0];
  if(!original)return NextResponse.json({error:"This request is not ready for earliest-visit booking"},{status:409});
  const plan=await fallbackPlan({serviceId:original.service_id,language:original.preferred_language,latitude:Number(original.latitude),longitude:Number(original.longitude),customerId:user.id});
  if(!plan.earliestAvailableAt)return NextResponse.json({error:"No future visit is available in the next three days. Please try again later."},{status:409});
  const otp=String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
  const updated=await sql(
    `UPDATE pim_v2.bookings SET status='REQUESTED',request_type='SCHEDULED_PUJA',scheduled_at=$3,pandit_id=NULL,
       amount=(SELECT base_price FROM pim_v2.services WHERE id=bookings.service_id),arrival_otp=$4,arrival_otp_attempts=0,
       dispatch_status='SEARCHING',search_radius_km=0,max_search_radius_km=40,travel_surcharge=0,next_expansion_at=now(),
       request_expires_at=NULL,declined_pandit_ids=ARRAY[]::uuid[]
     WHERE id=$1 AND customer_id=$2 AND status='DECLINED' AND dispatch_status='EXHAUSTED' RETURNING id`,
    [body.bookingId,user.id,plan.earliestAvailableAt,await encryptArrivalOtp(otp)],
  );
  if(!updated.rows[0])return NextResponse.json({error:"This request changed. Refresh and try again."},{status:409});
  await recordBookingEvent({bookingId:body.bookingId,actorId:user.id,actorRole:user.role,eventType:"EARLIEST_VISIT_RESERVED",fromStatus:"DECLINED",toStatus:"REQUESTED",metadata:{scheduledAt:plan.earliestAvailableAt,maxRadiusKm:40}});
  const dispatch=await startBookingDispatch(body.bookingId);
  return NextResponse.json({success:true,scheduledAt:plan.earliestAvailableAt,dispatch});
}
