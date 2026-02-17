import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { cleanupStaleSessions } from "@/lib/import-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  cleanupStaleSessions();

  return NextResponse.json({
    success: true,
    message: "Staging cleanup completed",
  });
}
