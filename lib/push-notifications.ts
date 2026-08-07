import webpush from "web-push";
import { sql } from "./db";
import { VAPID_PUBLIC_KEY } from "./push-config";
import { adminPhoneAllowlist } from "./env";

type PushRow = { id: string; endpoint: string; p256dh: string; auth: string };

export async function notifyUser(userId: string, message: { title: string; body: string; url: string; eventType: string }) {
  await sql(`INSERT INTO pim_v2.notifications(id,user_id,title,body,url,event_type) VALUES($1,$2,$3,$4,$5,$6)`,
    [crypto.randomUUID(), userId, message.title, message.body, message.url, message.eventType]);
  const preference = await sql<{ booking_updates:boolean; chat_updates:boolean; service_updates:boolean }>(`SELECT booking_updates,chat_updates,service_updates FROM pim_v2.notification_preferences WHERE user_id=$1`,[userId]);
  const selected = preference.rows[0];
  const pushAllowed = message.eventType.startsWith("BOOKING_") ? selected?.booking_updates !== false : message.eventType.startsWith("CONSULTATION_") || message.eventType.startsWith("CHAT_") ? selected?.chat_updates !== false : selected?.service_updates !== false;
  if (!pushAllowed) return { stored: true, pushConfigured: true, subscriptions: 0, delivered: 0, preferenceDisabled: true };
  const publicKey = VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return { stored: true, pushConfigured: false, subscriptions: 0, delivered: 0 };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "mailto:support@panditconnect.in", publicKey, privateKey);
  const subscriptions = await sql<PushRow>(`SELECT id,endpoint,p256dh,auth FROM pim_v2.push_subscriptions WHERE user_id=$1`, [userId]);
  const deliveries = await Promise.all(subscriptions.rows.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), { TTL: 300, urgency: "high" });
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await sql(`DELETE FROM pim_v2.push_subscriptions WHERE id=$1`, [subscription.id]);
      else console.error("Push delivery failed", error);
      return false;
    }
  }));
  return { stored: true, pushConfigured: true, subscriptions: subscriptions.rows.length, delivered: deliveries.filter(Boolean).length };
}

export async function notifyAdmins(message: { title: string; body: string; url: string; eventType: string }) {
  const allowed = new Set([...adminPhoneAllowlist()].map((phone) => phone.replace(/\D/g, "").slice(-10)));
  if (!allowed.size) return [];
  const users = await sql<{ id: string; phone: string }>(`SELECT id,phone FROM pim_v2.users`);
  const adminIds = [...new Set(users.rows.filter((user) => allowed.has(user.phone.replace(/\D/g, "").slice(-10))).map((user) => user.id))];
  return Promise.all(adminIds.map((adminId) => notifyUser(adminId, message)));
}
