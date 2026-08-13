import { LoginForm } from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { googleOAuthConfigured } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string; next?: string; google_error?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/customer") && !params.next.startsWith("//") ? params.next : undefined;
  const user = await currentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : user.role === "PANDIT" ? "/pandit" : nextPath ?? "/customer");
  return <LoginForm initialRole={params.role === "pandit" ? "PANDIT" : "CUSTOMER"} nextPath={nextPath} googleError={params.google_error?.slice(0, 240)} googleEnabled={googleOAuthConfigured()} />;
}
