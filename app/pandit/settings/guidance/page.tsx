import { PanditGuidanceSettings } from "@/components/pandit-guidance-settings";
import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditGuidancePage(){const user=await currentUser();if(!user)redirect("/login?role=pandit");if(user.role!=="PANDIT")redirect("/customer");return <PanditSettingsShell userName={user.name} active="guidance" title="Online guidance" subtitle="Set your availability and reply to private guidance chats."><PanditGuidanceSettings/></PanditSettingsShell>;}
