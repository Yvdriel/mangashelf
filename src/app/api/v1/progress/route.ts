import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { readingProgress } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const changedSinceRaw = searchParams.get("changedSince");

  const conditions = [eq(readingProgress.userId, session.user.id)];
  if (changedSinceRaw !== null) {
    const changedSince = parseInt(changedSinceRaw, 10);
    if (Number.isNaN(changedSince)) {
      return NextResponse.json({ error: "Invalid changedSince" }, { status: 400 });
    }
    conditions.push(gt(readingProgress.updatedAt, new Date(changedSince * 1000)));
  }

  const rows = db
    .select()
    .from(readingProgress)
    .where(and(...conditions))
    .all();

  const progress = rows.map((row) => ({
    mangaId: row.mangaId,
    volumeId: row.volumeId,
    currentPage: row.currentPage,
    isCompleted: row.isCompleted,
    updatedAt: Math.floor(row.updatedAt.getTime() / 1000),
  }));

  return NextResponse.json({
    serverTime: Math.floor(Date.now() / 1000),
    progress,
  });
}
