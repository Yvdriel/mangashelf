import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  getImportSession,
  updateSession,
  getActiveImportSession,
} from "@/lib/import-session";
import type { ImportConfig } from "@/lib/import-session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check for concurrent imports
  const active = getActiveImportSession();
  if (active) {
    return NextResponse.json(
      {
        error: "An import is already in progress",
        activeImportId: active.id,
      },
      { status: 409 },
    );
  }

  const body = await request.json();
  const { sessionId, title, anilistId, volumes, mode, addToManager, monitor } =
    body as {
      sessionId: string;
      title: string;
      anilistId?: number;
      volumes: {
        id: string;
        volumeNumber: number;
        action: "import" | "skip" | "replace";
      }[];
      mode: "copy" | "move";
      addToManager: boolean;
      monitor: boolean;
    };

  if (!sessionId || !title || !volumes || !mode) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId, title, volumes, mode" },
      { status: 400 },
    );
  }

  const importSession = getImportSession(sessionId);
  if (!importSession) {
    return NextResponse.json(
      { error: "Import session not found" },
      { status: 404 },
    );
  }

  if (!importSession.analysis) {
    return NextResponse.json(
      { error: "Session has not been analyzed yet" },
      { status: 400 },
    );
  }

  if (importSession.status === "importing") {
    return NextResponse.json(
      { error: "This session is already importing" },
      { status: 409 },
    );
  }

  // Validate all volume IDs exist in the analysis
  const analysisVolumeIds = new Set(
    importSession.analysis.volumes.map((v) => v.id),
  );
  for (const vol of volumes) {
    if (!analysisVolumeIds.has(vol.id)) {
      return NextResponse.json(
        { error: `Volume ID ${vol.id} not found in analysis` },
        { status: 400 },
      );
    }
  }

  const importConfig: ImportConfig = {
    title,
    anilistId,
    volumes,
    mode,
    addToManager,
    monitor,
    sourceType: "filesystem",
  };

  updateSession(sessionId, {
    status: "importing",
    importConfig,
  });

  return NextResponse.json({ importId: sessionId });
}
