/**
 * System information for the status page.
 */

import fs from "fs";

export interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  uptime: number;
  startedAt: string;
  environment: string;
  docker: boolean;
  config: {
    mangaDir: string;
    dbPath: string;
    monitorInterval: number;
    downloadCheckInterval: number;
    autoDownload: boolean;
    maxUploadSize: number;
    browseRoots: string[];
  };
}

let packageVersion: string | null = null;

function getPackageVersion(): string {
  if (packageVersion) return packageVersion;
  try {
    // In standalone build, package.json is at different locations
    const candidates = [
      "package.json",
      "../package.json",
      "../../package.json",
    ];
    for (const candidate of candidates) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        if (pkg.version) {
          packageVersion = pkg.version;
          return pkg.version;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Ignore
  }
  return "0.0.0";
}

export function getSystemInfo(): SystemInfo {
  const uptimeSeconds = process.uptime();
  const MANGA_DIR = process.env.MANGA_DIR || "/manga";
  const IMPORT_BROWSE_ROOTS = process.env.IMPORT_BROWSE_ROOTS;

  let browseRoots: string[] = [];
  if (IMPORT_BROWSE_ROOTS) {
    browseRoots = IMPORT_BROWSE_ROOTS.split(",").map((r) => r.trim());
  }

  return {
    version: getPackageVersion(),
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    uptime: Math.round(uptimeSeconds),
    startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
    environment: process.env.NODE_ENV || "production",
    docker: fs.existsSync("/.dockerenv"),
    config: {
      mangaDir: MANGA_DIR,
      dbPath: process.env.DATABASE_URL || "/data/mangashelf.db",
      monitorInterval: parseInt(process.env.MONITOR_INTERVAL || "3600", 10),
      downloadCheckInterval: parseInt(
        process.env.DOWNLOAD_CHECK_INTERVAL || "30",
        10,
      ),
      autoDownload: process.env.AUTO_DOWNLOAD !== "false",
      maxUploadSize: parseInt(
        process.env.IMPORT_MAX_UPLOAD_SIZE || "2147483648",
        10,
      ),
      browseRoots,
    },
  };
}
