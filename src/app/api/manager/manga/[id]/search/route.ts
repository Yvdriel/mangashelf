import { NextResponse } from "next/server";
import { db } from "@/db";
import { managedManga } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchMangaVolumes } from "@/lib/jackett";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);
  const body = await request.json().catch(() => ({}));
  const volumeNumber = body.volumeNumber as number | undefined;

  const manga = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!manga) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const results = await searchMangaVolumes(
      {
        native: manga.titleNative,
        romaji: manga.titleRomaji,
        synonyms: JSON.parse(manga.synonyms || "[]"),
      },
      volumeNumber,
    );

    return NextResponse.json(results);
  } catch (e) {
    console.error("[Manager] Jackett search error:", e);
    return NextResponse.json(
      { error: "Failed to search torrents" },
      { status: 500 },
    );
  }
}
