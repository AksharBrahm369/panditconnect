import { NotificationSettings } from "@/components/notification-settings";
import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditNotificationSettingsPage() { const user = await currentUser(); if (!user) redirect("/login?role=pandit"); if (user.role !== "PANDIT") redirect("/customer"); return <PanditSettingsShell userName={user.name} active="notifications" title="Choose your notifications" subtitle="Stay informed about urgent bookings while controlling optional alerts."><NotificationSettings /></PanditSettingsShell>; }
