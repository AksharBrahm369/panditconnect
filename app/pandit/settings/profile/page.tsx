import { PanditProfileSettings } from "@/components/pandit-profile-settings";
import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditProfileSettingsPage() { const user = await currentUser(); if (!user) redirect("/login?role=pandit"); if (user.role !== "PANDIT") redirect("/customer"); return <PanditSettingsShell userName={user.name} active="profile" title="Edit your professional profile" subtitle="Update the information customers use when choosing a nearby Pandit."><PanditProfileSettings /></PanditSettingsShell>; }
