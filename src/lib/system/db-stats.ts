/**
 * Database statistics for the status page.
 * All queries are synchronous (better-sqlite3).
 */

import { db } from "@/db";
import {
  manga,
  volume,
  managedManga,
  managedVolume,
  user,
  importHistory,
} from "@/db/schema";
import { count, sum, eq, isNotNull, max } from "drizzle-orm";

export interface DatabaseStats {
  manga: {
    total: number;
    withAnilistMatch: number;
    withoutMatch: number;
  };
  volumes: {
    total: number;
    totalPages: number;
  };
  managedManga: {
    total: number;
    monitored: number;
    unmonitored: number;
  };
  managedVolumes: {
    total: number;
    imported: number;
    missing: number;
    downloading: number;
    failed: number;
  };
  users: {
    total: number;
    admins: number;
  };
  imports: {
    total: number;
    lastImportAt: string | null;
  };
}

export function getDatabaseStats(): DatabaseStats {
  // Manga stats
  const mangaTotal = db.select({ count: count() }).from(manga).get()!.count;
  const mangaWithAnilist = db
    .select({ count: count() })
    .from(manga)
    .where(isNotNull(manga.anilistId))
    .get()!.count;

  // Volume stats
  const volumeStats = db
    .select({
      total: count(),
      totalPages: sum(volume.pageCount),
    })
    .from(volume)
    .get()!;

  // Managed manga stats
  const managedTotal = db.select({ count: count() }).from(managedManga).get()!
    .count;
  const managedMonitored = db
    .select({ count: count() })
    .from(managedManga)
    .where(eq(managedManga.monitored, true))
    .get()!.count;

  // Managed volume stats by status
  const mvTotal = db.select({ count: count() }).from(managedVolume).get()!
    .count;
  const mvImported = db
    .select({ count: count() })
    .from(managedVolume)
    .where(eq(managedVolume.status, "imported"))
    .get()!.count;
  const mvMissing = db
    .select({ count: count() })
    .from(managedVolume)
    .where(eq(managedVolume.status, "missing"))
    .get()!.count;
  const mvDownloading = db
    .select({ count: count() })
    .from(managedVolume)
    .where(eq(managedVolume.status, "downloading"))
    .get()!.count;
  const mvFailed = db
    .select({ count: count() })
    .from(managedVolume)
    .where(eq(managedVolume.status, "failed"))
    .get()!.count;

  // User stats
  const userTotal = db.select({ count: count() }).from(user).get()!.count;
  const userAdmins = db
    .select({ count: count() })
    .from(user)
    .where(eq(user.role, "admin"))
    .get()!.count;

  // Import history stats
  const importTotal = db.select({ count: count() }).from(importHistory).get()!
    .count;
  const lastImport = db
    .select({ lastAt: max(importHistory.createdAt) })
    .from(importHistory)
    .get();
  const lastImportAt = lastImport?.lastAt
    ? lastImport.lastAt instanceof Date
      ? lastImport.lastAt.toISOString()
      : new Date((lastImport.lastAt as number) * 1000).toISOString()
    : null;

  return {
    manga: {
      total: mangaTotal,
      withAnilistMatch: mangaWithAnilist,
      withoutMatch: mangaTotal - mangaWithAnilist,
    },
    volumes: {
      total: volumeStats.total,
      totalPages: Number(volumeStats.totalPages) || 0,
    },
    managedManga: {
      total: managedTotal,
      monitored: managedMonitored,
      unmonitored: managedTotal - managedMonitored,
    },
    managedVolumes: {
      total: mvTotal,
      imported: mvImported,
      missing: mvMissing,
      downloading: mvDownloading,
      failed: mvFailed,
    },
    users: {
      total: userTotal,
      admins: userAdmins,
    },
    imports: {
      total: importTotal,
      lastImportAt,
    },
  };
}
