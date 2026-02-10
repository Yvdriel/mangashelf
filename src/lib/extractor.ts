import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import AdmZip from "adm-zip";

const EXTRACT_BASE = process.env.EXTRACT_DIR || "/tmp/mangashelf-extract";
const ARCHIVE_EXTENSIONS = new Set([".rar", ".cbr", ".zip", ".cbz", ".7z"]);
const JUNK_FILES = new Set(["thumbs.db", ".ds_store", "desktop.ini"]);
const JUNK_DIRS = new Set(["__macosx"]);

export function isArchive(filePath: string): boolean {
  return ARCHIVE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Scan a directory for archive files.
 */
export function findArchives(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && isArchive(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if a source path is an archive (single file) or a directory
 * containing archives, and if so extract to a temp dir. Returns the
 * path to use for import (either the extracted dir or the original path).
 */
export function extractIfNeeded(sourcePath: string): {
  importPath: string;
  tempDir: string | null;
  error: string | null;
} {
  // Case 1: sourcePath is a single archive file
  if (
    fs.existsSync(sourcePath) &&
    fs.statSync(sourcePath).isFile() &&
    isArchive(sourcePath)
  ) {
    const tempDir = createTempDir();
    try {
      extractArchive(sourcePath, tempDir);
      // Check for nested archives inside the extracted content
      extractNestedArchives(tempDir);
      cleanJunk(tempDir);
      return { importPath: tempDir, tempDir, error: null };
    } catch (e) {
      cleanupTempDir(tempDir);
      return { importPath: sourcePath, tempDir: null, error: String(e) };
    }
  }

  // Case 2: sourcePath is a directory — check if it contains archives
  if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
    const archives = findArchives(sourcePath);
    if (archives.length > 0) {
      const tempDir = createTempDir();
      try {
        for (const archive of archives) {
          extractArchive(archive, tempDir);
        }
        extractNestedArchives(tempDir);
        cleanJunk(tempDir);
        return { importPath: tempDir, tempDir, error: null };
      } catch (e) {
        cleanupTempDir(tempDir);
        return { importPath: sourcePath, tempDir: null, error: String(e) };
      }
    }
  }

  // No archives — return original path
  return { importPath: sourcePath, tempDir: null, error: null };
}

function createTempDir(): string {
  fs.mkdirSync(EXTRACT_BASE, { recursive: true });
  return fs.mkdtempSync(path.join(EXTRACT_BASE, "vol-"));
}

export function cleanupTempDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    console.error(`[MangaShelf] Failed to clean up temp dir: ${tempDir}`);
  }
}

function extractArchive(archivePath: string, destDir: string): void {
  const ext = path.extname(archivePath).toLowerCase();

  switch (ext) {
    case ".zip":
    case ".cbz": {
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(destDir, true);
      break;
    }
    case ".rar":
    case ".cbr": {
      execFileSync("bsdtar", ["-xf", archivePath, "-C", destDir], {
        timeout: 120_000,
      });
      break;
    }
    case ".7z": {
      execFileSync("7z", ["x", `-o${destDir}`, "-y", archivePath], {
        timeout: 120_000,
      });
      break;
    }
    default:
      throw new Error(`Unsupported archive format: ${ext}`);
  }
}

/**
 * Look for archives inside the extracted directory and extract them too.
 * Only goes one level deep to avoid infinite loops.
 */
function extractNestedArchives(dir: string): void {
  const archives = findArchivesRecursive(dir);
  for (const archive of archives) {
    const nestedDest = path.join(
      path.dirname(archive),
      path.parse(archive).name,
    );
    fs.mkdirSync(nestedDest, { recursive: true });
    try {
      extractArchive(archive, nestedDest);
      fs.unlinkSync(archive); // Remove the nested archive after extraction
    } catch (e) {
      console.warn(
        `[MangaShelf] Failed to extract nested archive ${archive}: ${e}`,
      );
    }
  }
}

function findArchivesRecursive(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !JUNK_DIRS.has(entry.name.toLowerCase())) {
      results.push(...findArchivesRecursive(fullPath));
    } else if (entry.isFile() && isArchive(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Remove junk files/dirs (__MACOSX, .DS_Store, Thumbs.db, etc.)
 */
function cleanJunk(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (JUNK_DIRS.has(entry.name.toLowerCase())) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        cleanJunk(fullPath);
      }
    } else if (JUNK_FILES.has(entry.name.toLowerCase())) {
      fs.unlinkSync(fullPath);
    }
  }
}
