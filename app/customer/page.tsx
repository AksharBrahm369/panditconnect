import { redirect } from "next/navigation";
import { CustomerPortal } from "@/components/customer-portal";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect("/pandit");
  const params = await searchParams;
  return <CustomerPortal key={user.id} customerId={user.id} customerName={user.name} initialStart={params.start === "guided" ? "guided" : undefined} />;
}
