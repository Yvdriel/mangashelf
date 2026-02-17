import { NextResponse } from "next/server";
import { db } from "@/db";
import { managedManga, managedVolume } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMangaDetail } from "@/lib/anilist";
import { requireAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allManga = db
    .select()
    .from(managedManga)
    .orderBy(managedManga.titleRomaji)
    .all();

  const result = allManga.map((m) => {
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
      ...m,
      synonyms: JSON.parse(m.synonyms || "[]"),
      genres: JSON.parse(m.genres || "[]"),
      volumeCount: volumes.length,
      importedCount,
      downloadingCount,
      missingCount,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { anilistId } = body;

  if (!anilistId || typeof anilistId !== "number") {
    return NextResponse.json(
      { error: "anilistId is required and must be a number" },
      { status: 400 },
    );
  }

  // Check if already added
  const existing = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.anilistId, anilistId))
    .get();

  if (existing) {
    return NextResponse.json(
      { error: "Manga already added to manager" },
      { status: 409 },
    );
  }

  // Fetch full details from AniList
  const detail = await getMangaDetail(anilistId);

  const newManga = db
    .insert(managedManga)
    .values({
      anilistId: detail.id,
      titleRomaji: detail.title.romaji,
      titleEnglish: detail.title.english,
      titleNative: detail.title.native,
      synonyms: JSON.stringify(detail.synonyms || []),
      coverImage: detail.coverImage.extraLarge || detail.coverImage.large,
      bannerImage: detail.bannerImage,
      description: detail.description,
      totalVolumes: detail.volumes,
      status: detail.status,
      genres: JSON.stringify(detail.genres || []),
      averageScore: detail.averageScore,
      staff: JSON.stringify(detail.staff?.edges || []),
    })
    .returning()
    .get();

  // Create volume entries for all known volumes
  const volumeCount = detail.volumes || 0;
  if (volumeCount > 0) {
    for (let i = 1; i <= volumeCount; i++) {
      db.insert(managedVolume)
        .values({
          managedMangaId: newManga.id,
          volumeNumber: i,
          status: "missing",
        })
        .run();
    }
  }

  return NextResponse.json(newManga, { status: 201 });
}
