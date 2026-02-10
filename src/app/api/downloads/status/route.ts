import { db } from "@/db";
import { managedManga, managedVolume } from "@/db/schema";
import { eq, inArray, and, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Active downloads: status is "downloading" or "downloaded" (awaiting import)
  const activeVolumes = db
    .select({
      managedVolumeId: managedVolume.id,
      volumeNumber: managedVolume.volumeNumber,
      progress: managedVolume.progress,
      downloadSpeed: managedVolume.downloadSpeed,
      status: managedVolume.status,
      mangaId: managedManga.id,
      anilistId: managedManga.anilistId,
      titleRomaji: managedManga.titleRomaji,
      titleEnglish: managedManga.titleEnglish,
      titleNative: managedManga.titleNative,
      coverImage: managedManga.coverImage,
    })
    .from(managedVolume)
    .innerJoin(managedManga, eq(managedVolume.managedMangaId, managedManga.id))
    .where(inArray(managedVolume.status, ["downloading", "downloaded"]))
    .orderBy(managedVolume.updatedAt)
    .all();

  // Recent completions: imported in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentVolumes = db
    .select({
      volumeNumber: managedVolume.volumeNumber,
      status: managedVolume.status,
      completedAt: managedVolume.updatedAt,
      mangaId: managedManga.id,
      anilistId: managedManga.anilistId,
      titleRomaji: managedManga.titleRomaji,
      titleEnglish: managedManga.titleEnglish,
      titleNative: managedManga.titleNative,
    })
    .from(managedVolume)
    .innerJoin(managedManga, eq(managedVolume.managedMangaId, managedManga.id))
    .where(
      and(
        eq(managedVolume.status, "imported"),
        gte(managedVolume.updatedAt, oneHourAgo),
      ),
    )
    .orderBy(managedVolume.updatedAt)
    .all();

  const mangaTitle = (r: {
    titleNative: string | null;
    titleRomaji: string | null;
    titleEnglish: string | null;
  }) => r.titleNative || r.titleRomaji || r.titleEnglish || "Unknown";

  return NextResponse.json({
    active: activeVolumes.map((r) => ({
      managedVolumeId: r.managedVolumeId,
      mangaTitle: mangaTitle(r),
      mangaId: r.mangaId,
      anilistId: r.anilistId,
      coverImage: r.coverImage,
      volumeNumber: r.volumeNumber,
      progress: r.progress,
      downloadSpeed: r.downloadSpeed,
      status: r.status,
    })),
    recent: recentVolumes.map((r) => ({
      mangaTitle: mangaTitle(r),
      mangaId: r.mangaId,
      anilistId: r.anilistId,
      volumeNumber: r.volumeNumber,
      status: r.status,
      completedAt: r.completedAt,
    })),
    summary: {
      activeCount: activeVolumes.length,
      recentCount: recentVolumes.length,
    },
  });
}
