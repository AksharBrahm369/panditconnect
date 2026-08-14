import { encryptArrivalOtp } from "./arrival-otp";
import { sql } from "./db";
import { notifyAdmins, notifyUser, retryQueuedPushNotifications } from "./push-notifications";
import { advanceDueBookingDispatches } from "./booking-dispatch";

type ExpiredRequest = { id:string;customer_id:string;pandit_id:string;service_id:string;request_type:string;preferred_language:string|null;latitude:number;longitude:number;scheduled_at:string|null;amount:number;auto_rematch_count:number };
type Match = { id:string;name:string;charge:number };
type Reminder = { id:string;customer_id:string;pandit_id:string;service_name:string;scheduled_at:string };

async function declineRequest(booking:ExpiredRequest,message:string){
  const changed=await sql(`UPDATE pim_v2.bookings SET status='DECLINED',request_expires_at=NULL WHERE id=$1 AND status='REQUESTED' AND request_expires_at<=now() RETURNING id`,[booking.id]);
  if(changed.rows[0])await notifyUser(booking.customer_id,{title:"No Pandit accepted yet",body:message,url:"/customer#live-requests",eventType:"BOOKING_DECLINED"});
  return changed.rows[0]?"declined" as const:"unchanged" as const;
}

async function rematchExpiredRequest(booking: ExpiredRequest) {
  if(booking.auto_rematch_count>=2)return declineRequest(booking,"We tried nearby eligible Pandits but nobody is available. Open the booking to try later.");
  const matches = await sql<Match>(
    `SELECT u.id,u.name,ps.charge
     FROM pim_v2.pandit_profiles p
     JOIN pim_v2.users u ON u.id=p.user_id AND u.account_status='ACTIVE'
     JOIN pim_v2.pandit_services ps ON ps.pandit_id=p.user_id AND ps.service_id=$2
     WHERE p.verification_status='APPROVED' AND ($3='SCHEDULED_PUJA' OR p.is_online=true)
       AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL AND p.user_id<>$4 AND p.user_id<>$5 AND ps.charge<=$6
       AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM unnest(p.languages) language WHERE lower(language)=lower($7)))
       AND ($8::timestamptz IS NULL OR NOT EXISTS(SELECT 1 FROM pim_v2.bookings busy WHERE busy.pandit_id=p.user_id AND busy.id<>$1 AND busy.scheduled_at BETWEEN $8::timestamptz-interval '3 hours' AND $8::timestamptz+interval '3 hours' AND busy.status IN ('REQUESTED','ACCEPTED','ON_THE_WAY','ARRIVED','IN_PROGRESS')))
       AND 6371*acos(least(1,greatest(-1,cos(radians($9))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians($10))+sin(radians($9))*sin(radians(p.latitude)))))<=least(COALESCE(p.service_radius_km,25),25)
     ORDER BY 6371*acos(least(1,greatest(-1,cos(radians($9))*cos(radians(p.latitude))*cos(radians(p.longitude)-radians($10))+sin(radians($9))*sin(radians(p.latitude))))),p.rating DESC
     LIMIT 1`,
    [booking.id,booking.service_id,booking.request_type,booking.customer_id,booking.pandit_id,booking.amount,booking.preferred_language,booking.scheduled_at,booking.latitude,booking.longitude],
  );
  const match=matches.rows[0];
  if(!match)return declineRequest(booking,"No other suitable nearby Pandit is available right now. Open the booking to try again.");
  const otp=String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,"0");
  const changed=await sql(
    `UPDATE pim_v2.bookings SET pandit_id=$2,arrival_otp=$3,arrival_otp_attempts=0,auto_rematch_count=auto_rematch_count+1,
       request_expires_at=now()+CASE WHEN request_type='SCHEDULED_PUJA' THEN interval '24 hours' ELSE interval '5 minutes' END,
       declined_pandit_ids=CASE WHEN pandit_id=ANY(COALESCE(declined_pandit_ids,ARRAY[]::uuid[])) THEN declined_pandit_ids ELSE array_append(COALESCE(declined_pandit_ids,ARRAY[]::uuid[]),pandit_id) END
     WHERE id=$1 AND status='REQUESTED' AND pandit_id=$4 AND request_expires_at<=now() RETURNING id`,
    [booking.id,match.id,await encryptArrivalOtp(otp),booking.pandit_id],
  );
  if(!changed.rows[0])return "unchanged" as const;
  await sql(`INSERT INTO pim_v2.booking_events(id,booking_id,event_type,from_status,to_status,metadata) VALUES($1,$2,'BOOKING_AUTO_REMATCHED','REQUESTED','REQUESTED',$3::jsonb)`,[crypto.randomUUID(),booking.id,JSON.stringify({fromPanditId:booking.pandit_id,toPanditId:match.id,reason:"REQUEST_TIMEOUT"})]);
  await Promise.all([
    notifyUser(match.id,{title:"New nearby Puja request",body:"A request was reassigned to you because the customer still needs help.",url:"/pandit#pandit-requests",eventType:"BOOKING_REQUESTED"}),
    notifyUser(booking.customer_id,{title:"We found another Pandit",body:`${match.name} has received your request. The price has not increased.`,url:"/customer#live-requests",eventType:"BOOKING_REMATCHED"}),
  ]);
  return "rematched" as const;
}

export async function runScheduledOperations(){
  await advanceDueBookingDispatches();
  const cleanup=await sql<{sessions:string;otps:string;typing:string;limits:string}>(`WITH sessions AS (DELETE FROM pim_v2.sessions WHERE expires_at<now()-interval '7 days' RETURNING 1),otps AS (DELETE FROM pim_v2.otp_challenges WHERE created_at<now()-interval '2 days' RETURNING 1),typing AS (DELETE FROM pim_v2.consultation_typing WHERE expires_at<now()-interval '1 hour' RETURNING 1),limits AS (DELETE FROM pim_v2.api_rate_limits WHERE updated_at<now()-interval '2 days' RETURNING 1) SELECT (SELECT count(*) FROM sessions)::text AS sessions,(SELECT count(*) FROM otps)::text AS otps,(SELECT count(*) FROM typing)::text AS typing,(SELECT count(*) FROM limits)::text AS limits`);
  const reminders=await sql<Reminder>(`UPDATE pim_v2.bookings b SET reminder_sent_at=now() FROM pim_v2.services s WHERE b.service_id=s.id AND b.status='ACCEPTED' AND b.scheduled_at BETWEEN now() AND now()+interval '48 hours' AND b.reminder_sent_at IS NULL RETURNING b.id,b.customer_id,b.pandit_id,s.name AS service_name,b.scheduled_at`);
  for(const reminder of reminders.rows){
    const when=new Date(reminder.scheduled_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"});
    await Promise.all([
      notifyUser(reminder.customer_id,{title:"Your scheduled Puja is approaching",body:`${reminder.service_name} is scheduled for ${when}. Check the confirmed muhurat and samagri guidance in your booking.`,url:`/customer#booking-${reminder.id}`,eventType:"SCHEDULED_PUJA_REMINDER"}),
      notifyUser(reminder.pandit_id,{title:"Puja reminder: prepare now",body:`${reminder.service_name} is scheduled for ${when}. Recheck the muhurat, samagri, customer chat and travel plan.`,url:`/pandit/schedule#scheduled-booking-${reminder.id}`,eventType:"SCHEDULED_PUJA_REMINDER"}),
    ]);
  }
  const expired=await sql<ExpiredRequest>(`SELECT id,customer_id,pandit_id,service_id,request_type,preferred_language,latitude,longitude,scheduled_at,amount,auto_rematch_count FROM pim_v2.bookings WHERE status='REQUESTED' AND request_expires_at<=now() ORDER BY request_expires_at LIMIT 40`);
  let rematched=0,declined=0;
  for(const booking of expired.rows){const outcome=await rematchExpiredRequest(booking);if(outcome==="rematched")rematched+=1;if(outcome==="declined")declined+=1;}
  const escalated=await sql<{id:string;subject:string;priority:string}>(`UPDATE pim_v2.support_cases SET escalated_at=now(),priority=CASE WHEN priority='NORMAL' THEN 'URGENT' ELSE priority END,updated_at=now() WHERE status IN ('OPEN','IN_REVIEW') AND escalated_at IS NULL AND (first_response_due_at<now() OR resolution_due_at<now()) RETURNING id,subject,priority`);
  for(const supportCase of escalated.rows)await notifyAdmins({title:"Support SLA missed",body:supportCase.subject,url:"/admin#admin-support",eventType:"SUPPORT_CASE_ESCALATED"});
  const push=await retryQueuedPushNotifications();
  return {cleanup:cleanup.rows[0]??{},reminders:reminders.rows.length,expired:expired.rows.length,rematched,declined,supportEscalations:escalated.rows.length,push};
}
