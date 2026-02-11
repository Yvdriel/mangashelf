import fs from "fs";
import path from "path";
import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";

// Use globalThis to share state across Next.js module instances
// (instrumentation.ts and API routes may load separate copies of this module)
const g = globalThis as unknown as { __mangashelf_scanning?: boolean };
export function isScanning(): boolean {
  return g.__mangashelf_scanning ?? false;
}
function setScanningFlag(v: boolean) {
  g.__mangashelf_scanning = v;
}
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const MANGA_FOLDER_RE = /^(.+?)\s*\[anilist-(\d+)\]$/;
const VOLUME_FOLDER_RE = /^v(\d+)$/i;

interface ScannedManga {
  title: string;
  anilistId: number | null;
  folderName: string;
  volumes: ScannedVolume[];
}

interface ScannedVolume {
  number: number;
  folderName: string;
  pages: string[];
}

function parsePageNumber(filename: string): number {
  const name = path.parse(filename).name;
  const stripped = name.replace(/^_+/, "");
  return parseInt(stripped, 10);
}

function sortPages(files: string[]): string[] {
  return files.slice().sort((a, b) => parsePageNumber(a) - parsePageNumber(b));
}

function scanFilesystem(): ScannedManga[] {
  if (!fs.existsSync(MANGA_DIR)) {
    console.warn(`[MangaShelf] MANGA_DIR does not exist: ${MANGA_DIR}`);
    return [];
  }

  const results: ScannedManga[] = [];
  const entries = fs.readdirSync(MANGA_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const match = MANGA_FOLDER_RE.exec(entry.name);
    const title = match ? match[1].trim() : entry.name;
    const anilistId = match ? parseInt(match[2], 10) : null;

    const mangaPath = path.join(MANGA_DIR, entry.name);
    const volEntries = fs.readdirSync(mangaPath, { withFileTypes: true });
    const volumes: ScannedVolume[] = [];

    for (const volEntry of volEntries) {
      if (!volEntry.isDirectory()) continue;

      const volMatch = VOLUME_FOLDER_RE.exec(volEntry.name);
      if (!volMatch) continue;

      const volNumber = parseInt(volMatch[1], 10);
      const pagesPath = path.join(mangaPath, volEntry.name);
      const pageFiles = fs
        .readdirSync(pagesPath)
        .filter(
          (f) =>
            !f.startsWith(".") &&
            IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()),
        );

      const sorted = sortPages(pageFiles);

      if (sorted.length > 0) {
        volumes.push({
          number: volNumber,
          folderName: volEntry.name,
          pages: sorted,
        });
      }
    }

    volumes.sort((a, b) => a.number - b.number);

    if (volumes.length > 0) {
      results.push({ title, anilistId, folderName: entry.name, volumes });
    }
  }

  return results;
}

export function syncLibrary(): {
  added: number;
  updated: number;
  removed: number;
} {
  setScanningFlag(true);
  try {
    return _syncLibraryInner();
  } finally {
    setScanningFlag(false);
  }
}

function _syncLibraryInner(): {
  added: number;
  updated: number;
  removed: number;
} {
  const scanned = scanFilesystem();
  const scannedByFolder = new Map(scanned.map((m) => [m.folderName, m]));

  const existing = db.select().from(manga).all();
  const existingByFolder = new Map(existing.map((m) => [m.folderName, m]));

  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const item of scanned) {
    const ex = existingByFolder.get(item.folderName);
    const coverImage = `${item.folderName}/${item.volumes[0].folderName}/${item.volumes[0].pages[0]}`;

    if (!ex) {
      const newManga = db
        .insert(manga)
        .values({
          title: item.title,
          anilistId: item.anilistId,
          folderName: item.folderName,
          coverImage,
          totalVolumes: item.volumes.length,
        })
        .returning()
        .get();

      for (const vol of item.volumes) {
        db.insert(volume)
          .values({
            mangaId: newManga.id,
            volumeNumber: vol.number,
            folderName: vol.folderName,
            pageCount: vol.pages.length,
          })
          .run();
      }
      added++;
    } else {
      db.update(manga)
        .set({
          title: item.title,
          anilistId: item.anilistId,
          coverImage,
          totalVolumes: item.volumes.length,
          updatedAt: new Date(),
        })
        .where(eq(manga.id, ex.id))
        .run();

      // Upsert volumes: update existing, insert new (preserves volume IDs for reading_progress)
      const existingVolumes = db
        .select()
        .from(volume)
        .where(eq(volume.mangaId, ex.id))
        .all();
      const existingVolByNumber = new Map(
        existingVolumes.map((v) => [v.volumeNumber, v]),
      );

      for (const vol of item.volumes) {
        const exVol = existingVolByNumber.get(vol.number);
        if (exVol) {
          db.update(volume)
            .set({
              folderName: vol.folderName,
              pageCount: vol.pages.length,
            })
            .where(eq(volume.id, exVol.id))
            .run();
        } else {
          db.insert(volume)
            .values({
              mangaId: ex.id,
              volumeNumber: vol.number,
              folderName: vol.folderName,
              pageCount: vol.pages.length,
            })
            .run();
        }
      }
      updated++;
    }
  }

  // Remove manga entries no longer present on disk
  for (const ex of existing) {
    if (!scannedByFolder.has(ex.folderName)) {
      db.delete(manga).where(eq(manga.id, ex.id)).run();
      removed++;
    }
  }

  // Remove volumes no longer present on disk for manga that still exist
  for (const item of scanned) {
    const ex = existingByFolder.get(item.folderName);
    if (!ex) continue;

    const scannedVolNumbers = new Set(item.volumes.map((v) => v.number));
    const existingVolumes = db
      .select()
      .from(volume)
      .where(eq(volume.mangaId, ex.id))
      .all();

    for (const exVol of existingVolumes) {
      if (!scannedVolNumbers.has(exVol.volumeNumber)) {
        db.delete(volume).where(eq(volume.id, exVol.id)).run();
      }
    }
  }

  return { added, updated, removed };
}
