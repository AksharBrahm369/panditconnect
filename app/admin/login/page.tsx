import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AdminLoginForm } from "@/components/admin-login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await currentUser();
  if (user?.role === "ADMIN") redirect("/admin");
  return <AdminLoginForm />;
}
