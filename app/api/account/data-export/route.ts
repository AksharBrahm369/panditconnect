import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { authorizationResponse } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    const user=await requireUser();
    const [profile,bookings,consultations,messages,bookingMessages,notifications,support,consents]=await Promise.all([
      user.role==="CUSTOMER"?sql(`SELECT email,default_address,preferred_language,created_at,updated_at FROM pim_v2.customer_profiles WHERE user_id=$1`,[user.id]):user.role==="PANDIT"?sql(`SELECT email,date_of_birth,current_address,experience_years,languages,specialities,bio,service_radius_km,verification_status,created_at,updated_at FROM pim_v2.pandit_profiles WHERE user_id=$1`,[user.id]):Promise.resolve({rows:[]}),
      sql(`SELECT id,service_id,status,amount,request_type,scheduled_at,created_at,completed_at,cancellation_reason,cancellation_fee,cancellation_fee_status,payment_method,payment_status,customer_rating,rating_comment FROM pim_v2.bookings WHERE customer_id=$1 OR pandit_id=$1 ORDER BY created_at DESC`,[user.id]),
      sql(`SELECT id,topic,status,rate_5min,blocks,amount,payment_status,payment_method,started_at,ends_at FROM pim_v2.consultations WHERE customer_id=$1 OR pandit_id=$1 ORDER BY started_at DESC`,[user.id]),
      sql(`SELECT m.consultation_id,m.message,m.created_at,(m.sender_id=$1) AS sent_by_you FROM pim_v2.consultation_messages m JOIN pim_v2.consultations c ON c.id=m.consultation_id WHERE c.customer_id=$1 OR c.pandit_id=$1 ORDER BY m.created_at`,[user.id]),
      sql(`SELECT m.booking_id,m.body AS message,m.created_at,(m.sender_id=$1) AS sent_by_you FROM pim_v2.booking_messages m JOIN pim_v2.bookings b ON b.id=m.booking_id WHERE b.customer_id=$1 OR b.pandit_id=$1 ORDER BY m.created_at`,[user.id]),
      sql(`SELECT title,body,url,event_type,read_at,created_at FROM pim_v2.notifications WHERE user_id=$1 ORDER BY created_at DESC`,[user.id]),
      sql(`SELECT category,subject,description,priority,status,resolution,created_at,updated_at FROM pim_v2.support_cases WHERE reporter_id=$1 ORDER BY created_at DESC`,[user.id]),
      sql(`SELECT consent_type,granted_at,revoked_at,policy_version,created_at FROM pim_v2.user_consents WHERE user_id=$1 ORDER BY created_at DESC`,[user.id]),
    ]);
    await sql(`INSERT INTO pim_v2.data_rights_requests(id,user_id,request_type,status,details,completed_at) VALUES($1,$2,'EXPORT','COMPLETED','Self-service JSON export',now())`,[crypto.randomUUID(),user.id]);
    return NextResponse.json({exportedAt:new Date().toISOString(),account:{phone:user.phone,role:user.role,name:user.name,city:user.city},profile:profile.rows[0]??null,bookings:bookings.rows,consultations:consultations.rows,messages:messages.rows,bookingMessages:bookingMessages.rows,notifications:notifications.rows,supportCases:support.rows,consents:consents.rows},{headers:{"Cache-Control":"private,no-store","Content-Disposition":`attachment; filename="panditconnect-data-${new Date().toISOString().slice(0,10)}.json"`}});
  }catch(error){return authorizationResponse(error)??NextResponse.json({error:"Unable to export account data"},{status:500});}
}
