import { getSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/auth/account-settings";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Account Settings</h1>
      <AccountSettings
        userId={session.user.id}
        userName={session.user.name}
        userEmail={session.user.email}
      />
    </div>
  );
}
