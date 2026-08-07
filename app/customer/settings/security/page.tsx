import { CustomerSettingsShell } from "@/components/customer-settings-shell";
import { SecuritySettings } from "@/components/security-settings";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerSecuritySettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect("/pandit");
  return <CustomerSettingsShell active="security" title="Privacy and security" subtitle="Review your verified account and signed-in session."><SecuritySettings phone={user.phone} /></CustomerSettingsShell>;
}
