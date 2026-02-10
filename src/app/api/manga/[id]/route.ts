import { NextResponse } from "next/server";
import { db } from "@/db";
import { manga, volume, readingProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);

  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const volumes = db
    .select()
    .from(volume)
    .where(eq(volume.mangaId, mangaId))
    .orderBy(volume.volumeNumber)
    .all();

  const progress = db
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.mangaId, mangaId))
    .all();

  const progressByVolume = new Map(progress.map((p) => [p.volumeId, p]));

  const volumesWithProgress = volumes.map((v) => {
    const p = progressByVolume.get(v.id);
    return {
      ...v,
      currentPage: p?.currentPage ?? null,
      isCompleted: p?.isCompleted ?? false,
      lastReadAt: p?.lastReadAt ?? null,
    };
  });

  return NextResponse.json({
    ...mangaData,
    volumes: volumesWithProgress,
  });
}
