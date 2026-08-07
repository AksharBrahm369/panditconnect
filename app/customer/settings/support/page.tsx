import { CustomerSettingsShell } from "@/components/customer-settings-shell";
import { SupportCenter } from "@/components/support-center";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerSupportSettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect("/pandit");
  return <CustomerSettingsShell active="support" title="Help and support" subtitle="Report a booking, account, service or safety problem."><SupportCenter /></CustomerSettingsShell>;
}
