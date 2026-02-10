import { db } from "@/db";
import { managedManga, managedVolume, downloadHistory } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { searchMangaVolumes, type TorrentResult } from "./jackett";
import { addTorrent } from "./deluge";
import { getMangaDetail } from "./anilist";

const MONITOR_INTERVAL =
  parseInt(process.env.MONITOR_INTERVAL || "3600", 10) * 1000;
const AUTO_DOWNLOAD = process.env.AUTO_DOWNLOAD !== "false";
const SEARCH_DELAY_MS = 2000;
const METADATA_REFRESH_HOURS = 24;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scoreTorrent(
  result: TorrentResult,
  medianSize: number | null,
): number {
  // Skip if no magnet link
  if (!result.magnetLink) return -1;

  // Skip tiny files (likely fake)
  if (result.size > 0 && result.size < 5 * 1024 * 1024) return -1;

  let score = result.seeders * 10;

  // Size comparison with other volumes of same manga
  if (medianSize && result.size > 0) {
    if (result.size > medianSize * 4) score -= 500;
    if (result.size < medianSize * 0.2) score -= 500;
  }

  return score;
}

function getMedianSize(sizes: number[]): number | null {
  const valid = sizes.filter((s) => s > 0).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? (valid[mid - 1] + valid[mid]) / 2
    : valid[mid];
}

export async function monitorSingleManga(mangaId: number): Promise<{
  searched: number;
  downloaded: number;
  available: number;
  failed: number;
}> {
  let searched = 0;
  let downloaded = 0;
  let available = 0;
  let failed = 0;

  const manga = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!manga) return { searched, downloaded, available, failed };

  const missingVolumes = db
    .select()
    .from(managedVolume)
    .where(
      and(
        eq(managedVolume.managedMangaId, mangaId),
        eq(managedVolume.status, "missing"),
      ),
    )
    .all();

  if (missingVolumes.length === 0)
    return { searched, downloaded, available, failed };

  const title =
    manga.titleNative || manga.titleRomaji || manga.titleEnglish || "";
  const synonyms: string[] = manga.synonyms ? JSON.parse(manga.synonyms) : [];

  console.log(
    `[Monitor] Checking ${title}: ${missingVolumes.length} missing volumes`,
  );

  // Get sizes of existing downloaded/imported volumes for size heuristic
  const existingVolumes = db
    .select()
    .from(managedVolume)
    .where(
      and(
        eq(managedVolume.managedMangaId, mangaId),
        inArray(managedVolume.status, ["imported", "downloaded"]),
      ),
    )
    .all();

  // We don't store file sizes in managedVolume, so medianSize will be null
  // unless we add that later. For now, skip size comparison.
  const medianSize: number | null = null;

  for (const vol of missingVolumes) {
    try {
      if (searched > 0) await sleep(SEARCH_DELAY_MS);

      const results = await searchMangaVolumes(
        {
          native: manga.titleNative,
          romaji: manga.titleRomaji,
          synonyms,
        },
        vol.volumeNumber,
      );
      searched++;

      if (results.length === 0) {
        console.log(
          `[Monitor] No results for ${title} vol ${vol.volumeNumber}`,
        );
        continue;
      }

      // Score and select best result
      const scored = results
        .map((r) => ({ result: r, score: scoreTorrent(r, medianSize) }))
        .filter((s) => s.score >= 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        console.log(
          `[Monitor] No suitable results for ${title} vol ${vol.volumeNumber}`,
        );
        continue;
      }

      const best = scored[0].result;

      if (AUTO_DOWNLOAD) {
        // Send to Deluge
        const torrentId = await addTorrent(best.magnetLink!);
        if (!torrentId) {
          console.error(
            `[Monitor] Failed to add torrent for ${title} vol ${vol.volumeNumber}`,
          );
          failed++;
          continue;
        }

        db.update(managedVolume)
          .set({
            status: "downloading",
            torrentId,
            updatedAt: new Date(),
          })
          .where(eq(managedVolume.id, vol.id))
          .run();

        const torrentName =
          best.magnetLink!.match(/dn=([^&]+)/)?.[1]?.replace(/\+/g, " ") ||
          best.title;

        db.insert(downloadHistory)
          .values({
            managedMangaId: mangaId,
            managedVolumeId: vol.id,
            torrentName: decodeURIComponent(torrentName),
            magnetLink: best.magnetLink!,
            status: "sent",
            autoDownloaded: true,
          })
          .run();

        console.log(
          `[Monitor] Auto-downloaded ${title} vol ${vol.volumeNumber} (${best.seeders} seeders)`,
        );
        downloaded++;
      } else {
        // Flag as available for manual approval
        db.update(managedVolume)
          .set({
            status: "available",
            magnetLink: best.magnetLink,
            updatedAt: new Date(),
          })
          .where(eq(managedVolume.id, vol.id))
          .run();

        console.log(
          `[Monitor] Flagged ${title} vol ${vol.volumeNumber} as available (${best.seeders} seeders)`,
        );
        available++;
      }
    } catch (e) {
      console.error(
        `[Monitor] Error searching ${title} vol ${vol.volumeNumber}:`,
        e,
      );
      failed++;
    }
  }

  // Update last monitored timestamp
  db.update(managedManga)
    .set({ lastMonitoredAt: new Date(), updatedAt: new Date() })
    .where(eq(managedManga.id, mangaId))
    .run();

  return { searched, downloaded, available, failed };
}

export async function runMonitoringCycle(): Promise<{
  mangaChecked: number;
  totalDownloaded: number;
  totalAvailable: number;
  totalFailed: number;
}> {
  const monitored = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.monitored, true))
    .all();

  console.log(
    `[Monitor] Starting monitoring cycle: ${monitored.length} manga to check`,
  );

  let mangaChecked = 0;
  let totalDownloaded = 0;
  let totalAvailable = 0;
  let totalFailed = 0;

  for (const manga of monitored) {
    const result = await monitorSingleManga(manga.id);
    mangaChecked++;
    totalDownloaded += result.downloaded;
    totalAvailable += result.available;
    totalFailed += result.failed;
  }

  console.log(
    `[Monitor] Cycle complete: ${mangaChecked} manga, ${totalDownloaded} downloaded, ${totalAvailable} available, ${totalFailed} failed`,
  );

  return { mangaChecked, totalDownloaded, totalAvailable, totalFailed };
}

export async function refreshReleasingManga(): Promise<number> {
  const cutoff = new Date(Date.now() - METADATA_REFRESH_HOURS * 60 * 60 * 1000);

  const releasing = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.status, "RELEASING"))
    .all()
    .filter((m) => !m.lastMetadataRefresh || m.lastMetadataRefresh < cutoff);

  if (releasing.length === 0) return 0;

  console.log(
    `[Monitor] Refreshing AniList metadata for ${releasing.length} releasing manga`,
  );

  let newVolumesCreated = 0;

  for (const manga of releasing) {
    try {
      const detail = await getMangaDetail(manga.anilistId);
      if (!detail) continue;

      const updates: Record<string, unknown> = {
        lastMetadataRefresh: new Date(),
        updatedAt: new Date(),
      };

      // Update status if changed
      if (detail.status && detail.status !== manga.status) {
        updates.status = detail.status;
      }

      // Check if total volumes increased
      if (
        detail.volumes &&
        (manga.totalVolumes === null || detail.volumes > manga.totalVolumes)
      ) {
        const oldTotal = manga.totalVolumes || 0;
        updates.totalVolumes = detail.volumes;

        // Create new managed volume entries for new volumes
        for (let v = oldTotal + 1; v <= detail.volumes; v++) {
          const existing = db
            .select()
            .from(managedVolume)
            .where(
              and(
                eq(managedVolume.managedMangaId, manga.id),
                eq(managedVolume.volumeNumber, v),
              ),
            )
            .get();

          if (!existing) {
            db.insert(managedVolume)
              .values({
                managedMangaId: manga.id,
                volumeNumber: v,
                status: "missing",
              })
              .run();
            newVolumesCreated++;
            console.log(
              `[Monitor] New volume detected: ${manga.titleRomaji || manga.titleNative} vol ${v}`,
            );
          }
        }
      }

      db.update(managedManga)
        .set(updates)
        .where(eq(managedManga.id, manga.id))
        .run();

      // Rate limit AniList calls
      await sleep(1000);
    } catch (e) {
      console.error(
        `[Monitor] Metadata refresh failed for ${manga.titleRomaji}:`,
        e,
      );
    }
  }

  return newVolumesCreated;
}

let monitorTimer: ReturnType<typeof setInterval> | null = null;

export function startMonitorInterval(): void {
  if (monitorTimer) return;

  console.log(
    `[Monitor] Starting auto-monitor every ${MONITOR_INTERVAL / 1000}s (AUTO_DOWNLOAD=${AUTO_DOWNLOAD})`,
  );

  monitorTimer = setInterval(async () => {
    try {
      await refreshReleasingManga();
      await runMonitoringCycle();
    } catch (e) {
      console.error("[Monitor] Monitoring cycle error:", e);
    }
  }, MONITOR_INTERVAL);

  const cleanup = () => {
    if (monitorTimer) clearInterval(monitorTimer);
    monitorTimer = null;
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}
