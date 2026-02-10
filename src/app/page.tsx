import { db } from "@/db";
import {
  manga,
  readingProgress,
  managedManga,
  managedVolume,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { LibraryFilter } from "@/components/library-filter";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const allManga = db
    .select({
      id: manga.id,
      anilistId: manga.anilistId,
      title: manga.title,
      coverImage: manga.coverImage,
      totalVolumes: manga.totalVolumes,
      createdAt: manga.createdAt,
      anilistCoverUrl: managedManga.coverImage,
      genres: managedManga.genres,
    })
    .from(manga)
    .leftJoin(managedManga, eq(manga.anilistId, managedManga.anilistId))
    .orderBy(manga.title)
    .all();

  const allProgress = db.select().from(readingProgress).all();
  const progressByManga = new Map<number, (typeof allProgress)[number][]>();
  for (const p of allProgress) {
    const list = progressByManga.get(p.mangaId) ?? [];
    list.push(p);
    progressByManga.set(p.mangaId, list);
  }

  // Get downloading volume counts per anilistId
  const downloadingVolumes = db
    .select({
      anilistId: managedManga.anilistId,
      volumeNumber: managedVolume.volumeNumber,
    })
    .from(managedVolume)
    .innerJoin(managedManga, eq(managedVolume.managedMangaId, managedManga.id))
    .where(eq(managedVolume.status, "downloading"))
    .all();

  const downloadingByAnilistId = new Map<number, number>();
  for (const dv of downloadingVolumes) {
    downloadingByAnilistId.set(
      dv.anilistId,
      (downloadingByAnilistId.get(dv.anilistId) || 0) + 1,
    );
  }

  const mangaWithProgress = allManga.map((m) => {
    const progress = progressByManga.get(m.id) ?? [];
    const completedVolumes = progress.filter((p) => p.isCompleted).length;
    const progressPercent =
      m.totalVolumes > 0
        ? Math.round((completedVolumes / m.totalVolumes) * 100)
        : 0;

    const lastReadAt = progress.reduce<Date | null>((latest, p) => {
      if (!latest || p.lastReadAt > latest) return p.lastReadAt;
      return latest;
    }, null);

    // Use AniList cover URL via local cache endpoint, fall back to page-based cover
    const coverUrl = m.anilistId ? `/api/covers/${m.anilistId}` : null;

    const genres: string[] = m.genres ? JSON.parse(m.genres) : [];

    return {
      id: m.id,
      title: m.title,
      coverImage: m.coverImage,
      coverUrl,
      genres,
      totalVolumes: m.totalVolumes,
      completedVolumes,
      progressPercent,
      lastReadAt,
      createdAt: m.createdAt,
      downloadingCount: m.anilistId
        ? downloadingByAnilistId.get(m.anilistId) || 0
        : 0,
    };
  });

  return (
    <div>
      <LibraryFilter manga={mangaWithProgress} />
    </div>
  );
}
