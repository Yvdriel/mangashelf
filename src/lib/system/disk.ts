/**
 * Disk space and file size utilities for the status page.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const DB_PATH = process.env.DATABASE_URL || "/data/mangashelf.db";
const STAGING_DIR = process.env.IMPORT_STAGING_DIR || "/tmp/mangashelf-import";

export interface LibraryDiskInfo {
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  libraryBytes: number;
  percentUsed: number;
}

export interface DatabaseInfo {
  path: string;
  sizeBytes: number;
}

export interface StagingInfo {
  path: string;
  activeSessions: number;
  totalSizeBytes: number;
}

// --- Library disk info ---

let librarySizeCache = { bytes: 0, cachedAt: 0 };
const LIBRARY_SIZE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function calcDirSize(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += calcDirSize(fullPath);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(fullPath).size;
        } catch {
          // Skip inaccessible files
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return total;
}

/**
 * Get partition total/available bytes using `df`.
 *
 * Node.js `statfsSync` only exposes `bsize` (preferred I/O block size) but
 * reports `blocks`/`bavail` in units of `frsize` (fragment size) which it does
 * NOT expose.  On Linux/Docker these two values differ (e.g. bsize=1048576,
 * frsize=4096), making `bsize * blocks` wildly incorrect.  `df -k` always
 * reports in 1K-blocks and handles this correctly on every platform.
 */
function getPartitionBytes(dir: string): { total: number; free: number } {
  try {
    // -k = 1K-blocks, -P = POSIX portable output (single header + data line)
    const out = execFileSync("df", ["-kP", dir], {
      encoding: "utf-8",
      timeout: 5000,
    });
    const lines = out.trim().split("\n");
    if (lines.length < 2) return { total: 0, free: 0 };
    // POSIX format: Filesystem 1024-blocks Used Available Capacity Mounted-on
    const parts = lines[1].split(/\s+/);
    const totalKB = parseInt(parts[1], 10);
    const availKB = parseInt(parts[3], 10);
    if (isNaN(totalKB) || isNaN(availKB)) return { total: 0, free: 0 };
    return { total: totalKB * 1024, free: availKB * 1024 };
  } catch {
    return { total: 0, free: 0 };
  }
}

export function getLibraryDiskInfo(): LibraryDiskInfo {
  const { total: totalBytes, free: freeBytes } = getPartitionBytes(MANGA_DIR);

  // Library size with caching
  if (Date.now() - librarySizeCache.cachedAt > LIBRARY_SIZE_CACHE_TTL) {
    librarySizeCache = {
      bytes: calcDirSize(MANGA_DIR),
      cachedAt: Date.now(),
    };
  }

  const usedBytes = totalBytes - freeBytes;
  const percentUsed = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    path: MANGA_DIR,
    totalBytes,
    usedBytes,
    freeBytes,
    libraryBytes: librarySizeCache.bytes,
    percentUsed: Math.round(percentUsed * 10) / 10,
  };
}

// --- Database info ---

export function getDatabaseInfo(): DatabaseInfo {
  let sizeBytes = 0;
  try {
    sizeBytes = fs.statSync(DB_PATH).size;
  } catch {
    // DB file might not exist yet
  }
  return { path: DB_PATH, sizeBytes };
}

// --- Staging info ---

export function getStagingInfo(): StagingInfo {
  let activeSessions = 0;
  let totalSizeBytes = 0;

  try {
    if (fs.existsSync(STAGING_DIR)) {
      const entries = fs.readdirSync(STAGING_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        activeSessions++;
        totalSizeBytes += calcDirSize(path.join(STAGING_DIR, entry.name));
      }
    }
  } catch {
    // Staging dir might not exist
  }

  return { path: STAGING_DIR, activeSessions, totalSizeBytes };
}
