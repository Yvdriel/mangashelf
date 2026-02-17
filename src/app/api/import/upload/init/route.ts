import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { createSession, updateSession } from "@/lib/import-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const importSession = createSession();
  updateSession(importSession.id, {
    status: "uploading",
    uploadBytesReceived: 0,
    uploadBytesTotal: 0,
  });

  return NextResponse.json({ sessionId: importSession.id });
}
