import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { recordBookingEvent } from "@/lib/booking-risk";
import { notifyAdmins,notifyUser } from "@/lib/push-notifications";

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user||user.role!=="PANDIT")return NextResponse.json({error:"Pandit login required"},{status:401});
  const {id}=await context.params;const body=await request.json() as {note?:string};const note=body.note?.trim()??"";
  if(note.length<10)return NextResponse.json({error:"Describe what happened in at least 10 characters."},{status:400});
  const supportId=crypto.randomUUID();
  const result=await sql<{customer_id:string;amount:number;cancellation_fee:number}>(`WITH changed AS (UPDATE pim_v2.bookings SET status='CANCELLED',cancellation_reason='Customer no-show: '||$3,cancelled_by=$2,cancelled_at=now(),cancellation_fee=least(199,greatest(1,round(amount*.3))),cancellation_fee_status='DISPUTED' WHERE id=$1 AND pandit_id=$2 AND status='ARRIVED' AND arrived_at<=now()-interval '15 minutes' RETURNING customer_id,amount,cancellation_fee),support AS (INSERT INTO pim_v2.support_cases(id,reporter_id,booking_id,category,subject,description,priority) SELECT $4,$2,$1,'NO_SHOW','Customer no-show after arrival',$5,'URGENT' FROM changed),fee AS (INSERT INTO pim_v2.account_ledger(id,user_id,booking_id,entry_type,amount,status,note) SELECT $6,customer_id,$1,'CANCELLATION_FEE',cancellation_fee,'DISPUTED','Customer no-show report pending Admin review' FROM changed ON CONFLICT DO NOTHING),compensation AS (INSERT INTO pim_v2.account_ledger(id,user_id,booking_id,entry_type,amount,status,note) SELECT $7,$2,$1,'PANDIT_COMPENSATION',round(cancellation_fee*.8)::int,'PENDING','Pending no-show review and fee collection' FROM changed) SELECT * FROM changed`,[id,user.id,note.slice(0,500),supportId,note.slice(0,2000),crypto.randomUUID(),crypto.randomUUID()]);
  const booking=result.rows[0];if(!booking)return NextResponse.json({error:"No-show can be reported 15 minutes after verified arrival."},{status:409});
  await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:"CUSTOMER_NO_SHOW_REPORTED",fromStatus:"ARRIVED",toStatus:"CANCELLED",metadata:{supportCaseId:supportId,note}});
  await notifyUser(booking.customer_id,{title:"No-show report opened",body:"The Pandit reported that nobody was available after arrival. Open support if this is incorrect.",url:"/customer#support",eventType:"BOOKING_NO_SHOW_REPORTED"});
  await notifyAdmins({title:"Urgent no-show review",body:"A Pandit reported a customer no-show after the arrival waiting period.",url:"/admin#admin-support",eventType:"SUPPORT_CASE_CREATED"});
  return NextResponse.json({success:true,supportCaseId:supportId,message:"Report submitted for Admin review. No customer penalty is applied until the evidence is reviewed."});
}
