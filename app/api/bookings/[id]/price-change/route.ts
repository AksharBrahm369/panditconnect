import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { notifyUser } from "@/lib/push-notifications";
import { recordBookingEvent } from "@/lib/booking-risk";

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user||user.role!=="PANDIT")return NextResponse.json({error:"Pandit login required"},{status:401});
  const {id}=await context.params;const body=await request.json() as {amount?:number;reason?:string};const amount=Math.round(Number(body.amount));const reason=body.reason?.trim()??"";
  if(!Number.isFinite(amount)||amount<1||amount>100000||reason.length<10)return NextResponse.json({error:"Enter a valid revised amount and a clear reason of at least 10 characters."},{status:400});
  const result=await sql<{customer_id:string;amount:number}>(`UPDATE pim_v2.bookings SET proposed_amount=$3,price_change_reason=$4,price_change_status='PENDING' WHERE id=$1 AND pandit_id=$2 AND status IN ('ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS') AND $3<>amount RETURNING customer_id,amount`,[id,user.id,amount,reason.slice(0,500)]);
  if(!result.rows[0])return NextResponse.json({error:"A price change is not available for this booking or amount."},{status:409});
  await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:"PRICE_CHANGE_PROPOSED",metadata:{previousAmount:result.rows[0].amount,proposedAmount:amount,reason}});
  await notifyUser(result.rows[0].customer_id,{title:"Pandit requested a price change",body:`Review the revised ₹${amount} amount before any additional work.`,url:"/customer#live-requests",eventType:"BOOKING_PRICE_CHANGE"});
  return NextResponse.json({success:true});
}

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user||user.role!=="CUSTOMER")return NextResponse.json({error:"Customer login required"},{status:401});
  const {id}=await context.params;const body=await request.json() as {decision?:"APPROVE"|"REJECT"};if(!["APPROVE","REJECT"].includes(body.decision??""))return NextResponse.json({error:"Choose approve or reject."},{status:400});
  const result=await sql<{pandit_id:string;proposed_amount:number}>(`UPDATE pim_v2.bookings SET amount=CASE WHEN $3='APPROVE' THEN proposed_amount ELSE amount END,price_change_status=CASE WHEN $3='APPROVE' THEN 'APPROVED' ELSE 'REJECTED' END WHERE id=$1 AND customer_id=$2 AND price_change_status='PENDING' RETURNING pandit_id,proposed_amount`,[id,user.id,body.decision]);
  if(!result.rows[0])return NextResponse.json({error:"This price request is no longer pending."},{status:409});
  await recordBookingEvent({bookingId:id,actorId:user.id,actorRole:user.role,eventType:`PRICE_CHANGE_${body.decision}`,metadata:{proposedAmount:result.rows[0].proposed_amount}});
  await notifyUser(result.rows[0].pandit_id,{title:`Price change ${body.decision==='APPROVE'?'approved':'rejected'}`,body:body.decision==='APPROVE'?`The customer approved ₹${result.rows[0].proposed_amount}.`:"Continue only with the previously agreed service and amount.",url:"/pandit#pandit-requests",eventType:"BOOKING_PRICE_CHANGE"});
  return NextResponse.json({success:true});
}
