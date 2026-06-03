import { getSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { TokenSettings } from "@/components/auth/token-settings";

export const dynamic = "force-dynamic";

export default async function TokenSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">API Tokens</h1>
      <TokenSettings />
    </div>
  );
}
