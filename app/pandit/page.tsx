import { redirect } from "next/navigation";
import { PanditPortal } from "@/components/pandit-portal";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanditPage() {
  const user = await currentUser();
  if (!user) redirect("/login?role=pandit");
  if (user.role !== "PANDIT") redirect("/customer");
  return <PanditPortal userName={user.name} />;
}
