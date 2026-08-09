import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { PrivacyRightsSettings } from "@/components/privacy-rights-settings";

export const dynamic="force-dynamic";
export default async function PanditPrivacyPage(){const user=await currentUser();if(!user)redirect("/login?role=pandit");if(user.role!=="PANDIT")redirect("/customer");return <PanditSettingsShell userName={user.name} active="privacy" title="Your privacy choices" subtitle="Control your data, documents and signed-in devices."><PrivacyRightsSettings role="PANDIT"/></PanditSettingsShell>;}
