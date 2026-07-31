import { redirect } from "next/navigation";
import { CustomerPortal } from "@/components/customer-portal";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerPage() {
  const user = await currentUser();
  if (!user) redirect("/login?role=customer");
  if (user.role !== "CUSTOMER") redirect("/pandit");
  return <CustomerPortal key={user.id} customerId={user.id} />;
}
