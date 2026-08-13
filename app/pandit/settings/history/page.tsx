import { PanditHistory } from "@/components/pandit-history";
import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditHistoryPage(){const user=await currentUser();if(!user)redirect("/login?role=pandit");if(user.role!=="PANDIT")redirect("/customer");return <PanditSettingsShell userName={user.name} active="history" title="History and earnings" subtitle="Review completed, cancelled and declined bookings away from your work screen."><PanditHistory/></PanditSettingsShell>;}
