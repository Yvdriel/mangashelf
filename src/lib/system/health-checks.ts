/**
 * Health check engine — proactive warnings about misconfigurations and problems.
 */

import fs from "fs";
import { db } from "@/db";
import { manga, managedVolume } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ServiceCheckResult } from "./service-checks";
import type { LibraryDiskInfo, StagingInfo, DatabaseInfo } from "./disk";
import type { DatabaseStats } from "./db-stats";
import type { VersionCheckResult } from "./version";
import { getTaskStates } from "../background/task-registry";

export interface HealthCheck {
  id: string;
  severity: "error" | "warning" | "info";
  category: "services" | "storage" | "library" | "configuration" | "import";
  title: string;
  message: string;
}

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const STAGING_DIR = process.env.IMPORT_STAGING_DIR || "/tmp/mangashelf-import";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function runHealthChecks(context: {
  services: ServiceCheckResult;
  disk: LibraryDiskInfo;
  database: DatabaseInfo;
  staging: StagingInfo;
  dbStats: DatabaseStats;
  versionCheck?: VersionCheckResult;
}): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const { services, disk, database, staging, dbStats } = context;

  // --- Errors ---

  // Manga dir not writable
  try {
    fs.accessSync(MANGA_DIR, fs.constants.W_OK);
  } catch {
    checks.push({
      id: "manga-dir-not-writable",
      severity: "error",
      category: "storage",
      title: "Manga directory is not writable",
      message: `Cannot write to ${MANGA_DIR}. Check permissions. Imports will fail.`,
    });
  }

  // Failed imports
  if (dbStats.managedVolumes.failed > 0) {
    checks.push({
      id: "failed-imports",
      severity: "error",
      category: "import",
      title: "Failed volume imports",
      message: `${dbStats.managedVolumes.failed} volume(s) have failed to import. Check the manager for details.`,
    });
  }

  // Deluge unreachable
  if (
    services.deluge.status === "unreachable" ||
    services.deluge.status === "error"
  ) {
    checks.push({
      id: "deluge-unreachable",
      severity: "error",
      category: "services",
      title: "Cannot connect to Deluge",
      message: services.deluge.message
        ? `Deluge: ${services.deluge.message}. Downloads will not work.`
        : "Cannot connect to Deluge. Downloads will not work.",
    });
  }

  // Jackett unreachable
  if (
    services.jackett.status === "unreachable" ||
    services.jackett.status === "error"
  ) {
    checks.push({
      id: "jackett-unreachable",
      severity: "error",
      category: "services",
      title: "Cannot connect to Jackett",
      message: services.jackett.message
        ? `Jackett: ${services.jackett.message}. Manager search will not work.`
        : "Cannot connect to Jackett. Manager search will not work.",
    });
  }

  // --- Warnings ---

  // Disk space critical (< 1GB)
  if (disk.freeBytes > 0 && disk.freeBytes < 1024 * 1024 * 1024) {
    checks.push({
      id: "disk-space-critical",
      severity: "warning",
      category: "storage",
      title: "Manga directory critically low on space",
      message: `Only ${formatBytes(disk.freeBytes)} free. Imports may fail.`,
    });
  } else if (disk.freeBytes > 0 && disk.freeBytes < 10 * 1024 * 1024 * 1024) {
    // Disk space low (< 10GB)
    checks.push({
      id: "disk-space-low",
      severity: "warning",
      category: "storage",
      title: "Manga directory low on space",
      message: `${formatBytes(disk.freeBytes)} free on the manga partition.`,
    });
  }

  // Download disk low (from Deluge)
  const delugeFreeBytes = services.deluge.details?.freeBytes as
    | number
    | undefined;
  if (
    delugeFreeBytes !== undefined &&
    delugeFreeBytes > 0 &&
    delugeFreeBytes < 5 * 1024 * 1024 * 1024
  ) {
    checks.push({
      id: "download-disk-low",
      severity: "warning",
      category: "storage",
      title: "Download directory low on space",
      message: `Only ${formatBytes(delugeFreeBytes)} free in the download directory.`,
    });
  }

  // No Jackett indexers
  if (
    services.jackett.status === "connected" ||
    services.jackett.status === "degraded"
  ) {
    const indexerCount = services.jackett.details?.configuredIndexers as
      | number
      | undefined;
    if (indexerCount === 0) {
      checks.push({
        id: "no-jackett-indexers",
        severity: "warning",
        category: "services",
        title: "No Jackett indexers configured",
        message:
          "Jackett has no indexers configured. The manager will not find any downloads.",
      });
    }
  }

  // Stuck downloads (> 48h)
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stuck = db
      .select({ id: managedVolume.id })
      .from(managedVolume)
      .where(eq(managedVolume.status, "downloading"))
      .all()
      .filter((v) => {
        const vol = db
          .select({ updatedAt: managedVolume.updatedAt })
          .from(managedVolume)
          .where(eq(managedVolume.id, v.id))
          .get();
        return vol?.updatedAt && vol.updatedAt < cutoff;
      });

    if (stuck.length > 0) {
      checks.push({
        id: "stuck-downloads",
        severity: "warning",
        category: "import",
        title: "Stuck downloads detected",
        message: `${stuck.length} volume(s) have been downloading for over 48 hours. Torrents may be stalled.`,
      });
    }
  } catch {
    // Skip if query fails
  }

  // Orphaned staging directories
  try {
    if (staging.activeSessions > 0 && staging.totalSizeBytes > 0) {
      // Check if any dirs are older than 24h
      const entries = fs.readdirSync(STAGING_DIR, { withFileTypes: true });
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      let orphanedCount = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const stat = fs.statSync(`${STAGING_DIR}/${entry.name}`);
          if (stat.mtimeMs < cutoff) {
            orphanedCount++;
          }
        } catch {
          continue;
        }
      }

      if (orphanedCount > 0) {
        checks.push({
          id: "orphaned-staging",
          severity: "warning",
          category: "storage",
          title: "Orphaned staging directories",
          message: `${orphanedCount} orphaned import staging director${orphanedCount === 1 ? "y" : "ies"} found. Use "Clean Up" to remove.`,
        });
      }
    }
  } catch {
    // Skip
  }

  // Missing env vars
  if (!process.env.JACKETT_URL) {
    checks.push({
      id: "missing-env-jackett",
      severity: "warning",
      category: "configuration",
      title: "Jackett URL not configured",
      message: "JACKETT_URL is not set. Manager search features will not work.",
    });
  }
  if (!process.env.DELUGE_URL || !process.env.DELUGE_PASSWORD) {
    checks.push({
      id: "missing-env-deluge",
      severity: "warning",
      category: "configuration",
      title: "Deluge not configured",
      message:
        "DELUGE_URL or DELUGE_PASSWORD is not set. Download features will not work.",
    });
  }

  // Monitoring stale
  try {
    const tasks = getTaskStates();
    const monitorTask = tasks.find((t) => t.name === "monitoring-cycle");
    if (monitorTask && monitorTask.enabled && monitorTask.intervalMs > 0) {
      if (
        monitorTask.lastRun &&
        Date.now() - new Date(monitorTask.lastRun.completedAt).getTime() >
          monitorTask.intervalMs * 2
      ) {
        const hoursAgo = Math.round(
          (Date.now() - new Date(monitorTask.lastRun.completedAt).getTime()) /
            (60 * 60 * 1000),
        );
        checks.push({
          id: "monitoring-stale",
          severity: "warning",
          category: "configuration",
          title: "Monitoring cycle overdue",
          message: `The monitoring cycle last ran ${hoursAgo} hours ago. Background tasks may have stopped.`,
        });
      }
    }
  } catch {
    // Skip
  }

  // DB entries without folders
  try {
    const allManga = db.select().from(manga).all();
    const missing = allManga.filter((m) => {
      try {
        return !fs.existsSync(`${MANGA_DIR}/${m.folderName}`);
      } catch {
        return false;
      }
    });
    if (missing.length > 0) {
      checks.push({
        id: "db-entries-without-folders",
        severity: "warning",
        category: "library",
        title: "Database entries with missing folders",
        message: `${missing.length} manga in the database have folders that no longer exist on disk. Run a library scan.`,
      });
    }
  } catch {
    // Skip
  }

  // Staging not writable
  try {
    // Ensure staging dir exists first
    if (!fs.existsSync(STAGING_DIR)) {
      fs.mkdirSync(STAGING_DIR, { recursive: true });
    }
    fs.accessSync(STAGING_DIR, fs.constants.W_OK);
  } catch {
    checks.push({
      id: "staging-not-writable",
      severity: "warning",
      category: "storage",
      title: "Import staging directory not writable",
      message: `Cannot write to ${STAGING_DIR}. Manual imports will fail.`,
    });
  }

  // --- Info ---

  // Database large
  if (database.sizeBytes > 100 * 1024 * 1024) {
    checks.push({
      id: "database-large",
      severity: "info",
      category: "storage",
      title: "Database file is large",
      message: `Database is ${formatBytes(database.sizeBytes)}. Consider running VACUUM if performance degrades.`,
    });
  }

  // Running as root
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    checks.push({
      id: "running-as-root",
      severity: "info",
      category: "configuration",
      title: "Running as root",
      message:
        "MangaShelf is running as root. Consider running as a non-root user for security.",
    });
  }

  // AniList rate limited
  const rateLimitRemaining = services.anilist.details?.rateLimitRemaining as
    | number
    | undefined;
  if (rateLimitRemaining !== undefined && rateLimitRemaining < 10) {
    checks.push({
      id: "anilist-rate-limited",
      severity: "info",
      category: "services",
      title: "AniList rate limit low",
      message: `Only ${rateLimitRemaining} AniList API requests remaining. Searches may be throttled.`,
    });
  }

  // Update available
  if (context.versionCheck?.updateAvailable === true) {
    const current = context.versionCheck.current?.shortSha ?? "unknown";
    const latest = context.versionCheck.latest?.shortSha;
    checks.push({
      id: "update-available",
      severity: "info",
      category: "configuration",
      title: "Update available",
      message: latest
        ? `A newer version is available. Current: ${current}, Latest: ${latest}.`
        : `A newer version is available. Current: ${current}.`,
    });
  }

  // Sort by severity
  const severityOrder = { error: 0, warning: 1, info: 2 };
  checks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return checks;
}
