import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  const user=await currentUser();if(!user)return NextResponse.json({error:"Login required"},{status:401});
  const {id}=await context.params;
  const owned=await sql(`SELECT 1 FROM pim_v2.bookings WHERE id=$1 AND (customer_id=$2 OR pandit_id=$2)`,[id,user.id]);
  if(!owned.rows[0]&&user.role!=="ADMIN")return NextResponse.json({error:"Booking not found"},{status:404});
  const events=await sql(`SELECT id,event_type,from_status,to_status,metadata,created_at FROM pim_v2.booking_events WHERE booking_id=$1 ORDER BY created_at`,[id]);
  return NextResponse.json({events:events.rows},{headers:{"Cache-Control":"private, no-store"}});
}
