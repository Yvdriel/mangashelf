import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import { StatusPage } from "@/components/system/StatusPage";

export const dynamic = "force-dynamic";

export default async function SystemStatusPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  return <StatusPage />;
}
