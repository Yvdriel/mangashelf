import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";
import { applyProgressEntry, type ProgressEntry } from "@/lib/progress";

interface BatchBody {
  entries?: ProgressEntry[];
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as BatchBody;
  const entries = Array.isArray(body.entries) ? body.entries : [];

  const accepted: { mangaId: number; volumeId: number }[] = [];
  const rejected: { mangaId: number; volumeId: number; reason: string }[] = [];

  for (const entry of entries) {
    const result = applyProgressEntry(session.user.id, entry);
    if (result.accepted) {
      accepted.push({ mangaId: entry.mangaId, volumeId: entry.volumeId });
    } else {
      rejected.push({
        mangaId: entry.mangaId,
        volumeId: entry.volumeId,
        reason: result.reason ?? "rejected",
      });
    }
  }

  return NextResponse.json({ accepted, rejected });
}
