import { CustomerSettingsShell } from "@/components/customer-settings-shell";
import { ProfileEditor } from "@/components/profile-editor";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerProfileSettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect("/pandit");
  return <CustomerSettingsShell active="profile" title="Edit your profile" subtitle="Keep your personal details and preferred Puja address up to date."><ProfileEditor role="CUSTOMER" /></CustomerSettingsShell>;
}
