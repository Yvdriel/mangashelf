import { NextResponse } from "next/server";
import { db } from "@/db";
import { downloadHistory, managedManga } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const downloads = db
    .select({
      id: downloadHistory.id,
      torrentName: downloadHistory.torrentName,
      status: downloadHistory.status,
      createdAt: downloadHistory.createdAt,
      mangaId: downloadHistory.managedMangaId,
      mangaTitle: managedManga.titleRomaji,
    })
    .from(downloadHistory)
    .leftJoin(managedManga, eq(downloadHistory.managedMangaId, managedManga.id))
    .orderBy(desc(downloadHistory.createdAt))
    .limit(50)
    .all();

  return NextResponse.json(downloads);
}
