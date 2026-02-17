import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getImportSession } from "@/lib/import-session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { sessionId } = await params;
  const importSession = getImportSession(sessionId);

  if (!importSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: importSession.status,
    bytesReceived: importSession.uploadBytesReceived ?? 0,
    bytesTotal: importSession.uploadBytesTotal ?? 0,
  });
}
