import webpush from "web-push";
import { sql } from "./db";
import { VAPID_PUBLIC_KEY } from "./push-config";
import { adminPhoneAllowlist } from "./env";

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string };
type QueuedPushRow = PushRow & { queue_id: string; notification_id: string; title: string; body: string; url: string; event_type: string; attempts: number };
const MANDATORY_ACCOUNT_EVENTS = new Set([
  "PANDIT_APPROVED",
  "PANDIT_REJECTED",
  "PANDIT_CHANGES_REQUESTED",
  "PANDIT_BLOCKED",
  "PANDIT_RESTRICTED",
  "PANDIT_UNBLOCKED",
]);

function pushTtl(eventType: string) {
  return MANDATORY_ACCOUNT_EVENTS.has(eventType) ? 7 * 24 * 60 * 60 : 300;
}

function configureWebPush() {
  const publicKey = VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:support@panditconnect.in", publicKey, privateKey);
  return true;
}

export async function notifyUser(userId: string, message: { title: string; body: string; url: string; eventType: string }) {
  const notificationId = crypto.randomUUID();
  await sql(`INSERT INTO pim_v2.notifications(id,user_id,title,body,url,event_type) VALUES($1,$2,$3,$4,$5,$6)`,
    [notificationId, userId, message.title, message.body, message.url, message.eventType]);
  const preference = await sql<{ booking_updates:boolean; chat_updates:boolean; service_updates:boolean }>(`SELECT booking_updates,chat_updates,service_updates FROM pim_v2.notification_preferences WHERE user_id=$1`,[userId]);
  const selected = preference.rows[0];
  const pushAllowed = MANDATORY_ACCOUNT_EVENTS.has(message.eventType) || (message.eventType.startsWith("BOOKING_") ? selected?.booking_updates !== false : message.eventType.startsWith("CONSULTATION_") || message.eventType.startsWith("CHAT_") ? selected?.chat_updates !== false : selected?.service_updates !== false);
  if (!pushAllowed) return { stored: true, pushConfigured: true, subscriptions: 0, delivered: 0, preferenceDisabled: true };
  if (!configureWebPush()) return { stored: true, pushConfigured: false, subscriptions: 0, delivered: 0 };
  const subscriptions = await sql<PushRow>(`SELECT id,endpoint,p256dh,auth FROM pim_v2.push_subscriptions WHERE user_id=$1`, [userId]);
  const deliveries = await Promise.all(subscriptions.rows.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), { TTL: pushTtl(message.eventType), urgency: "high" });
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql(`DELETE FROM pim_v2.push_subscriptions WHERE id=$1`, [subscription.id]);
      else {
        console.error("Push delivery failed", error);
        await sql(
          `INSERT INTO pim_v2.push_delivery_queue(id,notification_id,user_id,subscription_id,title,body,url,event_type,last_error)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT(notification_id,subscription_id) DO NOTHING`,
          [crypto.randomUUID(),notificationId,userId,subscription.id,message.title,message.body,message.url,message.eventType,error instanceof Error ? error.message.slice(0,500) : "Unknown push failure"],
        ).catch((queueError) => console.error("Unable to queue push retry", queueError));
      }
      return false;
    }
  }));
  return { stored: true, pushConfigured: true, subscriptions: subscriptions.rows.length, delivered: deliveries.filter(Boolean).length };
}

export async function retryQueuedPushNotifications(limit = 100) {
  if (!configureWebPush()) return { attempted: 0, delivered: 0, abandoned: 0, configured: false };
  const due = await sql<QueuedPushRow>(
    `SELECT q.id AS queue_id,q.notification_id,q.title,q.body,q.url,q.event_type,q.attempts,
            s.id,s.endpoint,s.p256dh,s.auth
     FROM pim_v2.push_delivery_queue q
     JOIN pim_v2.push_subscriptions s ON s.id=q.subscription_id AND s.user_id=q.user_id
     WHERE q.status='PENDING' AND q.next_attempt_at<=now()
     ORDER BY q.next_attempt_at
     LIMIT $1`,
    [Math.max(1,Math.min(limit,500))],
  );
  let delivered = 0;
  let abandoned = 0;
  for (const item of due.rows) {
    try {
      await webpush.sendNotification(
        { endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth} },
        JSON.stringify({title:item.title,body:item.body,url:item.url,eventType:item.event_type}),
        {TTL:pushTtl(item.event_type),urgency:"high"},
      );
      delivered += 1;
      await sql(`UPDATE pim_v2.push_delivery_queue SET status='DELIVERED',attempts=attempts+1,delivered_at=now(),last_error=NULL WHERE id=$1`,[item.queue_id]);
    } catch (error) {
      const status = (error as {statusCode?:number}).statusCode;
      const terminal = status===404 || status===410 || item.attempts>=4;
      if (terminal) abandoned += 1;
      await sql(
        `UPDATE pim_v2.push_delivery_queue
         SET status=$2,attempts=attempts+1,next_attempt_at=now()+(power(2,least(attempts+1,6))::text||' minutes')::interval,last_error=$3
         WHERE id=$1`,
        [item.queue_id,terminal?"ABANDONED":"PENDING",error instanceof Error?error.message.slice(0,500):"Unknown push failure"],
      );
      if (status===404 || status===410) await sql(`DELETE FROM pim_v2.push_subscriptions WHERE id=$1`,[item.id]);
    }
  }
  await sql(`DELETE FROM pim_v2.push_delivery_queue WHERE created_at<now()-interval '30 days' AND status<>'PENDING'`);
  return {attempted:due.rows.length,delivered,abandoned,configured:true};
}

export async function notifyAdmins(message: { title: string; body: string; url: string; eventType: string }) {
  const allowed = new Set([...adminPhoneAllowlist()].map((phone) => phone.replace(/\D/g, "").slice(-10)));
  if (!allowed.size) return [];
  const users = await sql<{ id: string }>(
    `SELECT DISTINCT id
     FROM pim_v2.users
     WHERE role='ADMIN'
       AND right(regexp_replace(phone,'[^0-9]','','g'),10)=ANY($1::text[])`,
    [[...allowed]],
  );
  const adminIds = users.rows.map((user) => user.id);
  return Promise.all(adminIds.map((adminId) => notifyUser(adminId, message)));
}
