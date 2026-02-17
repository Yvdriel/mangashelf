/**
 * Disk space and file size utilities for the status page.
 */

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

export function getLibraryDiskInfo(): LibraryDiskInfo {
  let totalBytes = 0;
  let freeBytes = 0;

  try {
    const stats = fs.statfsSync(MANGA_DIR);
    totalBytes = stats.bsize * stats.blocks;
    freeBytes = stats.bsize * stats.bavail;
  } catch {
    // statfsSync not available or dir doesn't exist
  }

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
