import fs from "fs";
import path from "path";
import { db } from "@/db";
import { managedManga, managedVolume } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTorrentStatus } from "./deluge";
import { syncLibrary } from "./scanner";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const DOWNLOAD_DIR = process.env.DELUGE_DOWNLOAD_DIR || "/downloads";
const IMPORT_INTERVAL =
  parseInt(process.env.IMPORT_INTERVAL || "300", 10) * 1000;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function findImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Handle nested folders (wrapper directories)
      files.push(...findImageFiles(fullPath));
    } else if (
      !entry.name.startsWith(".") &&
      IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function parsePageNumber(filename: string): number {
  const name = path.parse(filename).name;
  const stripped = name.replace(/^_+/, "");
  return parseInt(stripped, 10);
}

function importVolume(
  sourcePath: string,
  mangaTitle: string,
  anilistId: number,
  volumeNumber: number,
): boolean {
  const targetDir = path.join(
    MANGA_DIR,
    `${mangaTitle} [anilist-${anilistId}]`,
    `v${volumeNumber}`,
  );

  // Skip if target already exists
  if (fs.existsSync(targetDir)) {
    return true;
  }

  const imageFiles = findImageFiles(sourcePath);
  if (imageFiles.length === 0) return false;

  // Sort by parsed page number
  imageFiles.sort((a, b) => {
    const numA = parsePageNumber(path.basename(a));
    const numB = parsePageNumber(path.basename(b));
    // If parsing fails, fall back to string sort
    if (isNaN(numA) && isNaN(numB)) return a.localeCompare(b);
    if (isNaN(numA)) return 1;
    if (isNaN(numB)) return -1;
    return numA - numB;
  });

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy files with sequential naming
  for (let i = 0; i < imageFiles.length; i++) {
    const ext = path.extname(imageFiles[i]).toLowerCase();
    const newName = String(i + 1).padStart(3, "0") + ext;
    fs.copyFileSync(imageFiles[i], path.join(targetDir, newName));
  }

  return true;
}

export async function checkAndImportDownloads(): Promise<{
  imported: number;
  failed: number;
}> {
  let imported = 0;
  let failed = 0;

  const downloading = db
    .select()
    .from(managedVolume)
    .where(eq(managedVolume.status, "downloading"))
    .all();

  for (const vol of downloading) {
    if (!vol.torrentId) continue;

    try {
      const status = await getTorrentStatus(vol.torrentId);
      if (!status) continue;

      // Update to downloaded when seeding or paused after completion
      if (
        status.state === "Seeding" ||
        (status.state === "Paused" && status.progress === 100)
      ) {
        db.update(managedVolume)
          .set({ status: "downloaded", updatedAt: new Date() })
          .where(eq(managedVolume.id, vol.id))
          .run();

        // Find the manga info for import
        const manga = db
          .select()
          .from(managedManga)
          .where(eq(managedManga.id, vol.managedMangaId))
          .get();

        if (!manga) continue;

        const title =
          manga.titleRomaji || manga.titleEnglish || `Manga ${manga.anilistId}`;
        const sourcePath = path.join(status.downloadLocation, status.name);

        if (
          importVolume(sourcePath, title, manga.anilistId, vol.volumeNumber)
        ) {
          db.update(managedVolume)
            .set({ status: "imported", updatedAt: new Date() })
            .where(eq(managedVolume.id, vol.id))
            .run();
          imported++;
        } else {
          failed++;
        }
      }
    } catch (e) {
      console.error(
        `[MangaShelf] Import check failed for volume ${vol.id}:`,
        e,
      );
      failed++;
    }
  }

  // Trigger library rescan if anything was imported
  if (imported > 0) {
    try {
      syncLibrary();
    } catch (e) {
      console.error("[MangaShelf] Library rescan after import failed:", e);
    }
  }

  return { imported, failed };
}

let importTimer: ReturnType<typeof setInterval> | null = null;

export function startImportInterval(): void {
  if (importTimer) return;

  console.log(
    `[MangaShelf] Starting auto-import check every ${IMPORT_INTERVAL / 1000}s`,
  );

  importTimer = setInterval(async () => {
    try {
      const result = await checkAndImportDownloads();
      if (result.imported > 0 || result.failed > 0) {
        console.log(
          `[MangaShelf] Import check: ${result.imported} imported, ${result.failed} failed`,
        );
      }
    } catch (e) {
      console.error("[MangaShelf] Auto-import error:", e);
    }
  }, IMPORT_INTERVAL);
}
