import { CustomerSettingsShell } from "@/components/customer-settings-shell";
import { NotificationSettings } from "@/components/notification-settings";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerNotificationSettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect("/pandit");
  return <CustomerSettingsShell active="notifications" title="Choose your notifications" subtitle="Control booking, chat and optional account alerts."><NotificationSettings /></CustomerSettingsShell>;
}
