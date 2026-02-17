import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getImportSession, deleteSession } from "@/lib/import-session";

export const dynamic = "force-dynamic";

export async function DELETE(
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

  if (importSession.status === "importing") {
    return NextResponse.json(
      { error: "Cannot delete a session that is currently importing" },
      { status: 409 },
    );
  }

  deleteSession(sessionId);
  return NextResponse.json({ success: true });
}
