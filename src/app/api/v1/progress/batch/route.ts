import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";
import { applyProgressEntry, type ProgressEntry } from "@/lib/progress";

function isValidEntry(e: unknown): e is ProgressEntry {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    Number.isFinite(o.mangaId) &&
    Number.isFinite(o.volumeId) &&
    Number.isFinite(o.currentPage) &&
    Number.isFinite(o.clientUpdatedAt) &&
    (o.isCompleted === undefined || typeof o.isCompleted === "boolean")
  );
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEntries =
    typeof body === "object" && body !== null
      ? (body as { entries?: unknown }).entries
      : undefined;
  const entries = Array.isArray(rawEntries) ? rawEntries : [];

  const accepted: { mangaId: number; volumeId: number }[] = [];
  const rejected: { mangaId: number; volumeId: number; reason: string }[] = [];

  for (const entry of entries) {
    // Reject malformed entries up front — a bad shape would otherwise throw
    // inside the Drizzle comparisons and 500 the whole batch.
    if (!isValidEntry(entry)) {
      const o = (entry ?? {}) as Record<string, unknown>;
      rejected.push({
        mangaId: typeof o.mangaId === "number" ? o.mangaId : -1,
        volumeId: typeof o.volumeId === "number" ? o.volumeId : -1,
        reason: "invalid",
      });
      continue;
    }
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
