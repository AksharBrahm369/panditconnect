import { AdminPortal } from "@/components/admin-portal";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/login?reason=session");
  if (user.role !== "ADMIN") redirect(user.role === "PANDIT" ? "/pandit" : "/customer");
  return <AdminPortal />;
}
