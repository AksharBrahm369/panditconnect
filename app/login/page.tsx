import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  return <LoginForm initialRole={params.role === "pandit" ? "PANDIT" : "CUSTOMER"} />;
}

