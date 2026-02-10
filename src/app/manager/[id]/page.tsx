import { db } from "@/db";
import { managedManga, managedVolume, manga } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MangaDetail } from "@/components/manager/manga-detail";

export const dynamic = "force-dynamic";

export default async function ManagedMangaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);

  const mangaData = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!mangaData) notFound();

  const volumes = db
    .select()
    .from(managedVolume)
    .where(eq(managedVolume.managedMangaId, mangaId))
    .orderBy(managedVolume.volumeNumber)
    .all();

  // Check if any volumes have been imported to the reader (match by anilist_id)
  const readerManga = db
    .select()
    .from(manga)
    .where(eq(manga.anilistId, mangaData.anilistId))
    .get();

  return (
    <MangaDetail
      manga={{
        ...mangaData,
        synonyms: JSON.parse(mangaData.synonyms || "[]"),
        genres: JSON.parse(mangaData.genres || "[]"),
      }}
      volumes={volumes}
      readerMangaId={readerManga?.id || null}
    />
  );
}
