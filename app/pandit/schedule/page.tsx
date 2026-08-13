import { AppShell } from "@/components/app-shell";
import { PanditSchedule } from "@/components/pandit-schedule";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function SchedulePage(){const user=await currentUser();if(!user)redirect("/login?role=pandit");if(user.role!=="PANDIT")redirect("/customer");return <AppShell role="Pandit" userName={user.name} title="Your schedule" subtitle="Upcoming scheduled Puja requests in one place." showHeading><PanditSchedule/></AppShell>;}
