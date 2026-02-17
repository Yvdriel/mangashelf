import { getSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const session = await getSession();
  if (!session || session.user.role !== "admin") {
    redirect("/login");
  }

  return <ImportWizard />;
}
