import { NextResponse } from "next/server";
import { db } from "@/db";
import { manga, volume, readingProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const allManga = db.select().from(manga).orderBy(manga.title).all();

  const result = allManga.map((m) => {
    const volumes = db
      .select()
      .from(volume)
      .where(eq(volume.mangaId, m.id))
      .all();

    const progress = db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.mangaId, m.id))
      .all();

    const completedVolumes = progress.filter((p) => p.isCompleted).length;
    const totalVolumes = volumes.length;
    const progressPercent =
      totalVolumes > 0
        ? Math.round((completedVolumes / totalVolumes) * 100)
        : 0;

    const lastRead = progress.reduce<Date | null>((latest, p) => {
      if (!latest || p.lastReadAt > latest) return p.lastReadAt;
      return latest;
    }, null);

    return {
      ...m,
      completedVolumes,
      progressPercent,
      lastReadAt: lastRead,
    };
  });

  return NextResponse.json(result);
}
