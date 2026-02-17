import { db } from "@/db";
import { user } from "@/db/schema";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth/setup-form";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .get();
  const userCount = result?.count ?? 0;

  if (userCount > 0) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-surface-600 bg-surface-800 p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-accent-300">MangaShelf</h1>
            <p className="mt-2 text-sm text-surface-200">
              Welcome! Create your admin account to get started.
            </p>
          </div>
          <SetupForm />
        </div>
      </div>
    </div>
  );
}
