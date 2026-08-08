import { LoginForm } from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "PANDIT" ? "/pandit" : "/customer");
  const params = await searchParams;
  return <LoginForm initialRole={params.role === "pandit" ? "PANDIT" : "CUSTOMER"} />;
}
