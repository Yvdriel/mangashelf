import { db } from "@/db";
import { manga, readingProgress } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MangaCard } from "@/components/manga-card";
import { LibraryFilter } from "@/components/library-filter";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const allManga = db.select().from(manga).orderBy(manga.title).all();

  const mangaWithProgress = allManga.map((m) => {
    const progress = db
      .select()
      .from(readingProgress)
      .where(eq(readingProgress.mangaId, m.id))
      .all();

    const completedVolumes = progress.filter((p) => p.isCompleted).length;
    const progressPercent =
      m.totalVolumes > 0
        ? Math.round((completedVolumes / m.totalVolumes) * 100)
        : 0;

    const lastReadAt = progress.reduce<Date | null>((latest, p) => {
      if (!latest || p.lastReadAt > latest) return p.lastReadAt;
      return latest;
    }, null);

    return {
      id: m.id,
      title: m.title,
      coverImage: m.coverImage,
      totalVolumes: m.totalVolumes,
      completedVolumes,
      progressPercent,
      lastReadAt,
      createdAt: m.createdAt,
    };
  });

  return (
    <div>
      <LibraryFilter manga={mangaWithProgress} />
    </div>
  );
}
