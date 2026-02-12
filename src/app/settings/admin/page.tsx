import { getSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/auth/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPanelPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">User Management</h1>
      <AdminPanel />
    </div>
  );
}
