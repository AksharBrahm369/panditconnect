import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { CustomerSettingsShell } from "@/components/customer-settings-shell";
import { PrivacyRightsSettings } from "@/components/privacy-rights-settings";

export const dynamic="force-dynamic";
export default async function CustomerPrivacyPage(){const user=await currentUser();if(!user)redirect("/login?role=customer");if(user.role!=="CUSTOMER")redirect("/pandit");return <CustomerSettingsShell active="privacy" title="Your privacy choices" subtitle="Control your data and signed-in devices."><PrivacyRightsSettings role="CUSTOMER"/></CustomerSettingsShell>;}
