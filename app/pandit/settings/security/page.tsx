import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { SecuritySettings } from "@/components/security-settings";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditSecuritySettingsPage() { const user = await currentUser(); if (!user) redirect("/login?role=pandit"); if (user.role !== "PANDIT") redirect("/customer"); return <PanditSettingsShell userName={user.name} active="security" title="Privacy and security" subtitle="Review your verified account and keep private information protected."><SecuritySettings phone={user.phone} /></PanditSettingsShell>; }
