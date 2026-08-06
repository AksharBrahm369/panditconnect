import webpush from "web-push";
import { sql } from "./db";
import { VAPID_PUBLIC_KEY } from "./push-config";

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string };

export async function notifyUser(userId: string, message: { title: string; body: string; url: string; eventType: string }) {
  await sql(`INSERT INTO pim_v2.notifications(id,user_id,title,body,url,event_type) VALUES($1,$2,$3,$4,$5,$6)`,
    [crypto.randomUUID(), userId, message.title, message.body, message.url, message.eventType]);
  const publicKey = VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:support@panditconnect.in", publicKey, privateKey);
  const subscriptions = await sql<PushRow>(`SELECT id,endpoint,p256dh,auth FROM pim_v2.push_subscriptions WHERE user_id=$1`, [userId]);
  await Promise.allSettled(subscriptions.rows.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), { TTL: 300, urgency: "high" });
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql(`DELETE FROM pim_v2.push_subscriptions WHERE id=$1`, [subscription.id]);
      else console.error("Push delivery failed", error);
    }
  }));
}
