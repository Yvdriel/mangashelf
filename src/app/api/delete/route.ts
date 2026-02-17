import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { manga, managedManga } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    mangaIds,
    managedMangaIds,
    deleteFiles,
  }: {
    mangaIds?: number[];
    managedMangaIds?: number[];
    deleteFiles: boolean;
  } = body;

  if (
    (!mangaIds || mangaIds.length === 0) &&
    (!managedMangaIds || managedMangaIds.length === 0)
  ) {
    return NextResponse.json({ error: "No manga specified" }, { status: 400 });
  }

  const errors: string[] = [];
  let deleted = 0;

  // Collect all anilistIds and folderNames for cross-domain resolution
  const readerRecords: {
    id: number;
    anilistId: number | null;
    folderName: string;
  }[] = [];
  const managedRecords: { id: number; anilistId: number }[] = [];

  // Resolve reader manga records
  if (mangaIds && mangaIds.length > 0) {
    const records = db
      .select({
        id: manga.id,
        anilistId: manga.anilistId,
        folderName: manga.folderName,
      })
      .from(manga)
      .where(inArray(manga.id, mangaIds))
      .all();
    readerRecords.push(...records);
  }

  // Resolve managed manga records
  if (managedMangaIds && managedMangaIds.length > 0) {
    const records = db
      .select({
        id: managedManga.id,
        anilistId: managedManga.anilistId,
      })
      .from(managedManga)
      .where(inArray(managedManga.id, managedMangaIds))
      .all();
    managedRecords.push(...records);
  }

  // Cross-domain resolution: reader → managed
  for (const r of readerRecords) {
    if (
      r.anilistId &&
      !managedRecords.some((m) => m.anilistId === r.anilistId)
    ) {
      const managed = db
        .select({ id: managedManga.id, anilistId: managedManga.anilistId })
        .from(managedManga)
        .where(eq(managedManga.anilistId, r.anilistId))
        .get();
      if (managed) {
        managedRecords.push(managed);
      }
    }
  }

  // Cross-domain resolution: managed → reader (only when deleting files)
  if (deleteFiles) {
    for (const m of managedRecords) {
      if (!readerRecords.some((r) => r.anilistId === m.anilistId)) {
        const reader = db
          .select({
            id: manga.id,
            anilistId: manga.anilistId,
            folderName: manga.folderName,
          })
          .from(manga)
          .where(eq(manga.anilistId, m.anilistId))
          .get();
        if (reader) {
          readerRecords.push(reader);
        }
      }
    }
  }

  // Delete files from disk
  if (deleteFiles) {
    for (const r of readerRecords) {
      const folderPath = path.join(MANGA_DIR, r.folderName);
      try {
        fs.rmSync(folderPath, { recursive: true, force: true });
      } catch (e) {
        errors.push(`Failed to delete ${r.folderName}: ${String(e)}`);
      }
    }
  }

  // Delete from reader manga table (cascades to volume, readingProgress; sets null on importHistory)
  for (const r of readerRecords) {
    try {
      db.delete(manga).where(eq(manga.id, r.id)).run();
      deleted++;
    } catch (e) {
      errors.push(`Failed to delete reader record ${r.id}: ${String(e)}`);
    }
  }

  // Delete from managed manga table (cascades to managedVolume, downloadHistory)
  for (const m of managedRecords) {
    try {
      db.delete(managedManga).where(eq(managedManga.id, m.id)).run();
      // Only count if not already counted from reader deletion
      if (!readerRecords.some((r) => r.anilistId === m.anilistId)) {
        deleted++;
      }
    } catch (e) {
      errors.push(`Failed to delete managed record ${m.id}: ${String(e)}`);
    }
  }

  return NextResponse.json({ deleted, errors });
}
