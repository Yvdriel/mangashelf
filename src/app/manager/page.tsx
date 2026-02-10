import { db } from "@/db";
import { managedManga, managedVolume } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ManagerPage } from "@/components/manager/manager-page";

export const dynamic = "force-dynamic";

export default function ManagerRoute() {
  const allManga = db
    .select()
    .from(managedManga)
    .orderBy(managedManga.titleRomaji)
    .all();

  const mangaWithStats = allManga.map((m) => {
    const volumes = db
      .select()
      .from(managedVolume)
      .where(eq(managedVolume.managedMangaId, m.id))
      .all();

    const importedCount = volumes.filter((v) => v.status === "imported").length;
    const downloadingCount = volumes.filter(
      (v) => v.status === "downloading",
    ).length;
    const missingCount = volumes.filter((v) => v.status === "missing").length;

    return {
      id: m.id,
      anilistId: m.anilistId,
      titleRomaji: m.titleRomaji,
      titleEnglish: m.titleEnglish,
      titleNative: m.titleNative,
      coverImage: m.coverImage,
      totalVolumes: m.totalVolumes,
      status: m.status,
      averageScore: m.averageScore,
      monitored: m.monitored,
      volumeCount: volumes.length,
      importedCount,
      downloadingCount,
      missingCount,
    };
  });

  const anilistIds = new Set(allManga.map((m) => m.anilistId));

  return (
    <ManagerPage
      managedManga={mangaWithStats}
      existingAnilistIds={Array.from(anilistIds)}
    />
  );
}
