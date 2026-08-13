import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { SupportCenter } from "@/components/support-center";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditSupportPage(){const user=await currentUser();if(!user)redirect("/login?role=pandit");if(user.role!=="PANDIT")redirect("/customer");return <PanditSettingsShell userName={user.name} active="support" title="Help and support" subtitle="Get help with a booking, payment, account or safety concern."><SupportCenter/></PanditSettingsShell>;}
