import fs from "fs";
import path from "path";
import { db } from "@/db";
import { managedManga, managedVolume, downloadHistory } from "@/db/schema";
import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { getTorrentStatus } from "./deluge";
import { syncLibrary } from "./scanner";
import { extractIfNeeded, cleanupTempDir } from "./extractor";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const DOWNLOAD_DIR = "/downloads";
const DOWNLOAD_CHECK_INTERVAL =
  parseInt(process.env.DOWNLOAD_CHECK_INTERVAL || "30", 10) * 1000;
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

const VOLUME_PATTERN = /(?:vol(?:ume)?\.?\s*|v)(\d+)/i;

function detectVolumeFolders(
  dir: string,
): { volumeNumber: number; path: string }[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const volumes: { volumeNumber: number; path: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(VOLUME_PATTERN);
    if (match) {
      volumes.push({
        volumeNumber: parseInt(match[1], 10),
        path: path.join(dir, entry.name),
      });
    }
  }
  return volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
}

function detectVolumeFoldersWithUnwrap(
  dir: string,
): { volumeNumber: number; path: string }[] {
  let volumes = detectVolumeFolders(dir);
  if (volumes.length > 0) return volumes;

  // Single wrapper directory — look one level deeper
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const subdirs = entries.filter((e) => e.isDirectory());
  if (subdirs.length === 1) {
    volumes = detectVolumeFolders(path.join(dir, subdirs[0].name));
  }
  return volumes;
}

export async function updateDownloadProgress(): Promise<void> {
  const downloading = db
    .select()
    .from(managedVolume)
    .where(eq(managedVolume.status, "downloading"))
    .all();

  if (downloading.length === 0) return;

  for (const vol of downloading) {
    if (!vol.torrentId) continue;

    try {
      const status = await getTorrentStatus(vol.torrentId);
      if (!status) continue;

      const isComplete =
        status.state === "Seeding" ||
        (status.state === "Paused" && status.progress === 100);

      if (isComplete) {
        db.update(managedVolume)
          .set({
            status: "downloaded",
            progress: 100,
            downloadSpeed: 0,
            updatedAt: new Date(),
          })
          .where(eq(managedVolume.id, vol.id))
          .run();
      } else {
        db.update(managedVolume)
          .set({
            progress: Math.round(status.progress),
            downloadSpeed: status.downloadSpeed,
            updatedAt: new Date(),
          })
          .where(eq(managedVolume.id, vol.id))
          .run();
      }
    } catch (e) {
      console.error(
        `[MangaShelf] Progress check failed for volume ${vol.id}:`,
        e,
      );
    }
  }
}

export async function checkAndImportBulkDownloads(): Promise<{
  imported: number;
  failed: number;
}> {
  let imported = 0;
  let failed = 0;

  const bulkManga = db
    .select()
    .from(managedManga)
    .where(isNotNull(managedManga.bulkTorrentId))
    .all();

  if (bulkManga.length > 0) {
    console.log(
      `[MangaShelf] Found ${bulkManga.length} bulk downloads to check`,
    );
  }

  for (const manga of bulkManga) {
    if (!manga.bulkTorrentId) continue;

    try {
      const status = await getTorrentStatus(manga.bulkTorrentId);
      if (!status) {
        console.log(
          `[MangaShelf] Bulk ${manga.id}: no torrent status from Deluge for ${manga.bulkTorrentId}`,
        );
        continue;
      }

      console.log(
        `[MangaShelf] Bulk ${manga.id}: deluge state=${status.state} progress=${status.progress}`,
      );

      const isComplete =
        status.state === "Seeding" ||
        (status.state === "Paused" && status.progress === 100);
      if (!isComplete) continue;

      const title =
        manga.titleRomaji || manga.titleEnglish || `Manga ${manga.anilistId}`;
      const sourcePath = path.join(DOWNLOAD_DIR, status.name);

      console.log(
        `[MangaShelf] Bulk ${manga.id}: extracting from ${sourcePath}`,
      );

      const extraction = extractIfNeeded(sourcePath);
      if (extraction.error) {
        console.error(
          `[MangaShelf] Bulk ${manga.id}: extraction failed: ${extraction.error}`,
        );
        // Clear bulkTorrentId so we don't retry forever
        db.update(managedManga)
          .set({ bulkTorrentId: null, updatedAt: new Date() })
          .where(eq(managedManga.id, manga.id))
          .run();
        failed++;
        continue;
      }

      try {
        const volumes = detectVolumeFoldersWithUnwrap(extraction.importPath);
        console.log(
          `[MangaShelf] Bulk ${manga.id}: detected ${volumes.length} volume folders`,
        );

        if (volumes.length === 0) {
          console.warn(
            `[MangaShelf] Bulk ${manga.id}: no volume folders detected in ${extraction.importPath}`,
          );
          // Clear bulkTorrentId
          db.update(managedManga)
            .set({ bulkTorrentId: null, updatedAt: new Date() })
            .where(eq(managedManga.id, manga.id))
            .run();
          failed++;
          continue;
        }

        for (const vol of volumes) {
          // Find or create managed_volume row
          let mv = db
            .select()
            .from(managedVolume)
            .where(
              and(
                eq(managedVolume.managedMangaId, manga.id),
                eq(managedVolume.volumeNumber, vol.volumeNumber),
              ),
            )
            .get();

          if (mv?.status === "imported") {
            console.log(
              `[MangaShelf] Bulk ${manga.id}: vol ${vol.volumeNumber} already imported, skipping`,
            );
            continue;
          }

          if (!mv) {
            mv = db
              .insert(managedVolume)
              .values({
                managedMangaId: manga.id,
                volumeNumber: vol.volumeNumber,
                status: "downloaded",
              })
              .returning()
              .get();
          } else {
            db.update(managedVolume)
              .set({ status: "downloaded", updatedAt: new Date() })
              .where(eq(managedVolume.id, mv.id))
              .run();
          }

          const success = importVolume(
            vol.path,
            title,
            manga.anilistId,
            vol.volumeNumber,
          );
          console.log(
            `[MangaShelf] Bulk ${manga.id}: vol ${vol.volumeNumber} importVolume returned ${success}`,
          );

          if (success) {
            db.update(managedVolume)
              .set({ status: "imported", updatedAt: new Date() })
              .where(eq(managedVolume.id, mv.id))
              .run();
            imported++;
          } else {
            db.update(managedVolume)
              .set({
                status: "failed",
                errorMessage: "No image files found in volume folder",
                updatedAt: new Date(),
              })
              .where(eq(managedVolume.id, mv.id))
              .run();
            failed++;
          }
        }

        // Clear bulkTorrentId after processing
        db.update(managedManga)
          .set({ bulkTorrentId: null, updatedAt: new Date() })
          .where(eq(managedManga.id, manga.id))
          .run();
      } finally {
        if (extraction.tempDir) {
          cleanupTempDir(extraction.tempDir);
        }
      }
    } catch (e) {
      console.error(
        `[MangaShelf] Bulk import failed for manga ${manga.id}:`,
        e,
      );
      // Clear bulkTorrentId to avoid infinite retry
      db.update(managedManga)
        .set({ bulkTorrentId: null, updatedAt: new Date() })
        .where(eq(managedManga.id, manga.id))
        .run();
      failed++;
    }
  }

  return { imported, failed };
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
    .where(inArray(managedVolume.status, ["downloading", "downloaded"]))
    .all();

  console.log(
    `[MangaShelf] Found ${downloading.length} volumes to check (downloading/downloaded)`,
  );

  for (const vol of downloading) {
    if (!vol.torrentId) {
      console.log(`[MangaShelf] Volume ${vol.id} has no torrentId, skipping`);
      continue;
    }

    try {
      const status = await getTorrentStatus(vol.torrentId);
      if (!status) {
        console.log(
          `[MangaShelf] Volume ${vol.id}: no torrent status from Deluge for ${vol.torrentId}`,
        );
        continue;
      }

      console.log(
        `[MangaShelf] Volume ${vol.id}: deluge state=${status.state} progress=${status.progress} path=${status.downloadLocation}/${status.name}`,
      );

      // For volumes still downloading, check if Deluge has finished
      if (vol.status === "downloading") {
        const isComplete =
          status.state === "Seeding" ||
          (status.state === "Paused" && status.progress === 100);
        if (!isComplete) {
          console.log(
            `[MangaShelf] Volume ${vol.id}: still downloading, skipping`,
          );
          continue;
        }

        console.log(
          `[MangaShelf] Volume ${vol.id}: download complete, marking as downloaded`,
        );
        db.update(managedVolume)
          .set({ status: "downloaded", updatedAt: new Date() })
          .where(eq(managedVolume.id, vol.id))
          .run();
      }

      // At this point, volume is downloaded — attempt import
      const manga = db
        .select()
        .from(managedManga)
        .where(eq(managedManga.id, vol.managedMangaId))
        .get();

      if (!manga) {
        console.log(
          `[MangaShelf] Volume ${vol.id}: managed manga ${vol.managedMangaId} not found, skipping`,
        );
        continue;
      }

      const title =
        manga.titleRomaji || manga.titleEnglish || `Manga ${manga.anilistId}`;
      const sourcePath = path.join(DOWNLOAD_DIR, status.name);

      console.log(
        `[MangaShelf] Volume ${vol.id}: attempting import from ${sourcePath}`,
      );

      // Extract archives if needed before importing
      const extraction = extractIfNeeded(sourcePath);
      console.log(
        `[MangaShelf] Volume ${vol.id}: extraction result — importPath=${extraction.importPath} tempDir=${extraction.tempDir} error=${extraction.error}`,
      );

      if (extraction.error) {
        console.error(
          `[MangaShelf] Extraction failed for volume ${vol.id}: ${extraction.error}`,
        );
        db.update(managedVolume)
          .set({
            status: "failed",
            errorMessage: extraction.error,
            updatedAt: new Date(),
          })
          .where(eq(managedVolume.id, vol.id))
          .run();
        failed++;
        continue;
      }

      try {
        const success = importVolume(
          extraction.importPath,
          title,
          manga.anilistId,
          vol.volumeNumber,
        );
        console.log(
          `[MangaShelf] Volume ${vol.id}: importVolume returned ${success} (title="${title}" vol=${vol.volumeNumber})`,
        );

        if (success) {
          db.update(managedVolume)
            .set({ status: "imported", updatedAt: new Date() })
            .where(eq(managedVolume.id, vol.id))
            .run();

          // Update download history status to "imported"
          db.update(downloadHistory)
            .set({ status: "imported", updatedAt: new Date() })
            .where(eq(downloadHistory.managedVolumeId, vol.id))
            .run();

          imported++;
        } else {
          db.update(downloadHistory)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(downloadHistory.managedVolumeId, vol.id))
            .run();
          failed++;
        }
      } finally {
        if (extraction.tempDir) {
          cleanupTempDir(extraction.tempDir);
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

let backgroundTimer: ReturnType<typeof setInterval> | null = null;

export function startBackgroundTasks(): void {
  if (backgroundTimer) return;

  console.log(
    `[MangaShelf] Starting download check every ${DOWNLOAD_CHECK_INTERVAL / 1000}s`,
  );

  backgroundTimer = setInterval(async () => {
    try {
      await updateDownloadProgress();
      const bulk = await checkAndImportBulkDownloads();
      const single = await checkAndImportDownloads();
      const totalImported = bulk.imported + single.imported;
      const totalFailed = bulk.failed + single.failed;
      if (totalImported > 0 || totalFailed > 0) {
        console.log(
          `[MangaShelf] Import check: ${totalImported} imported, ${totalFailed} failed`,
        );
      }
    } catch (e) {
      console.error("[MangaShelf] Background task error:", e);
    }
  }, DOWNLOAD_CHECK_INTERVAL);

  // Graceful shutdown
  const cleanup = () => {
    if (backgroundTimer) clearInterval(backgroundTimer);
    backgroundTimer = null;
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

/** @deprecated Use startBackgroundTasks instead */
export const startImportInterval = startBackgroundTasks;
