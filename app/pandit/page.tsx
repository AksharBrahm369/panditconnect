import { redirect } from "next/navigation";
import { PanditPortal } from "@/components/pandit-portal";
import { PanditAccessStatus } from "@/components/pandit-access-status";
import { currentSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanditPage() {
  const user = await currentSessionUser();
  if (!user) redirect("/login?role=pandit");
  if (user.role !== "PANDIT") redirect("/customer");
  if (user.accountStatus === "BLOCKED" || user.accountStatus === "RESTRICTED") {
    return <PanditAccessStatus userName={user.name} status={user.accountStatus} reason={user.accountStatusReason} />;
  }
  const recentlyRestored = user.accountStatusReason === "Access restored by an administrator";
  return <PanditPortal userName={user.name} accessNotice={recentlyRestored ? "Your Pandit account has been unblocked. You can go online whenever you are ready." : null} />;
}
