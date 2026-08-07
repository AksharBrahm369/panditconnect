import { PanditSettingsShell } from "@/components/pandit-settings-shell";
import { PayoutSettings } from "@/components/payout-settings";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PanditPaymentSettingsPage() { const user = await currentUser(); if (!user) redirect("/login?role=pandit"); if (user.role !== "PANDIT") redirect("/customer"); return <PanditSettingsShell userName={user.name} active="payments" title="Manage your payout details" subtitle="Keep your private UPI or bank destination accurate and verified."><PayoutSettings /></PanditSettingsShell>; }
