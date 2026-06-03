import { NextResponse } from "next/server";
import { eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** UNIX seconds for a JS Date (drizzle timestamp columns read back as Dates). */
function toUnixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const changedSinceParam = searchParams.get("changedSince");

  // Manga-level delta only: the volume table has no updatedAt column, so we
  // can only filter on manga.updatedAt. When changedSince is provided, include
  // ONLY manga whose updatedAt (unix seconds) is strictly greater than it.
  let query = db.select().from(manga).$dynamic();
  if (changedSinceParam !== null) {
    const changedSince = parseInt(changedSinceParam, 10);
    if (Number.isNaN(changedSince)) {
      return NextResponse.json(
        { error: "Invalid changedSince" },
        { status: 400 },
      );
    }
    query = query.where(gt(manga.updatedAt, new Date(changedSince * 1000)));
  }

  const allManga = query.orderBy(manga.title).all();

  const mangaList = allManga.map((m) => {
    const volumes = db
      .select()
      .from(volume)
      .where(eq(volume.mangaId, m.id))
      .all();

    return {
      id: m.id,
      anilistId: m.anilistId,
      title: m.title,
      folderName: m.folderName,
      coverImage: m.coverImage,
      totalVolumes: m.totalVolumes,
      updatedAt: toUnixSeconds(m.updatedAt),
      volumes: volumes.map((v) => ({
        id: v.id,
        volumeNumber: v.volumeNumber,
        folderName: v.folderName,
        pageCount: v.pageCount,
      })),
    };
  });

  return NextResponse.json({
    serverTime: toUnixSeconds(new Date()),
    manga: mangaList,
  });
}
