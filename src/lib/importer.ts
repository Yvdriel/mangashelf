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
const JUNK_DIRS = new Set(["__macosx", ".ds_store"]);

// ---------------------------------------------------------------------------
// Image file discovery
// ---------------------------------------------------------------------------

function isImageFile(name: string): boolean {
  return (
    !name.startsWith(".") &&
    IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase())
  );
}

/** Find all image files directly inside a directory (non-recursive). */
function findDirectImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isImageFile(e.name))
    .map((e) => path.join(dir, e.name));
}

/** Recursively find all image files under a directory. */
function findImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (JUNK_DIRS.has(entry.name.toLowerCase()) || entry.name.startsWith("."))
        continue;
      files.push(...findImageFiles(fullPath));
    } else if (isImageFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Step 1: Recursive volume folder discovery
// ---------------------------------------------------------------------------

/**
 * Recursively find "volume folders" — the deepest folders that directly
 * contain image files. Intermediate folders that only contain subdirectories
 * are traversed but not returned.
 *
 * Edge case: if a folder has BOTH loose images AND subdirectories containing
 * images, the subdirectories are treated as volumes and the loose images are
 * treated as a separate volume (the folder itself is included).
 */
function findVolumeFolders(rootPath: string): string[] {
  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory())
    return [];

  const entries = fs.readdirSync(rootPath, { withFileTypes: true });

  const subdirs = entries.filter(
    (e) =>
      e.isDirectory() &&
      !JUNK_DIRS.has(e.name.toLowerCase()) &&
      !e.name.startsWith("."),
  );

  const hasDirectImages = entries.some(
    (e) => e.isFile() && isImageFile(e.name),
  );

  // Recurse into subdirectories
  const childVolumes: string[] = [];
  for (const sub of subdirs) {
    childVolumes.push(...findVolumeFolders(path.join(rootPath, sub.name)));
  }

  if (childVolumes.length > 0) {
    // Subdirectories contain volumes. If there are also loose images here,
    // treat this folder as an additional volume.
    if (hasDirectImages) {
      childVolumes.push(rootPath);
    }
    return childVolumes;
  }

  // No child volumes found. If this folder has images, it's a volume.
  if (hasDirectImages) {
    return [rootPath];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Unicode normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a folder name for volume number extraction:
 * - NFC normalization
 * - Fullwidth digits ０-９ → 0-9
 * - Fullwidth latin Ａ-Ｚ, ａ-ｚ → A-Z, a-z
 * - Fullwidth space \u3000 → regular space
 * - Trim whitespace (including fullwidth) from both ends
 */
function normalizeFolderName(name: string): string {
  let n = name.normalize("NFC");
  // Fullwidth digits U+FF10-U+FF19 → 0-9
  n = n.replace(/[\uFF10-\uFF19]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
  // Fullwidth uppercase U+FF21-U+FF3A → A-Z
  n = n.replace(/[\uFF21-\uFF3A]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff21 + 0x41),
  );
  // Fullwidth lowercase U+FF41-U+FF5A → a-z
  n = n.replace(/[\uFF41-\uFF5A]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff41 + 0x61),
  );
  // Fullwidth space → regular space
  n = n.replace(/\u3000/g, " ");
  // Trim whitespace from both ends
  return n.trim();
}

// ---------------------------------------------------------------------------
// Step 2: Volume number extraction from folder names
// ---------------------------------------------------------------------------

const VOLUME_PATTERNS: { name: string; regex: RegExp; group: number }[] = [
  { name: "第XX巻", regex: /第(\d+)巻/, group: 1 },
  { name: "XX巻", regex: /(\d+)巻/, group: 1 },
  { name: "fullwidth parens", regex: /（\s*(\d+)\s*）/, group: 1 },
  { name: "halfwidth parens", regex: /\(\s*(\d+)\s*\)/, group: 1 },
  {
    name: "vol/volume prefix",
    regex: /vol(?:ume)?\.?\s*(\d+)/i,
    group: 1,
  },
  { name: "v prefix", regex: /(?<![a-zA-Z])v(\d+)/i, group: 1 },
  { name: "underscore number", regex: /_(\d+)$/, group: 1 },
  {
    name: "CJK + number",
    regex: /[\u3000-\u9FFF\uF900-\uFAFF](\d+)[a-zA-Z]?\s*$/,
    group: 1,
  },
  { name: "bracketed number", regex: /\[v?(\d+)\]/i, group: 1 },
  { name: "trailing number", regex: /(\d+)\s*$/, group: 1 },
];

function extractVolumeNumber(
  folderName: string,
): { number: number; pattern: string } | null {
  const normalized = normalizeFolderName(folderName);
  for (const pat of VOLUME_PATTERNS) {
    const match = normalized.match(pat.regex);
    if (match) {
      const num = parseInt(match[pat.group], 10);
      if (num > 0) {
        return { number: num, pattern: pat.name };
      }
    }
  }
  return null;
}

/**
 * Try extracting a volume number from the folder itself, then walk up to
 * parent/grandparent as a fallback. Stops at downloadRoot.
 */
function extractVolumeNumberWithAncestors(
  folderPath: string,
  downloadRoot: string,
): { number: number; pattern: string } | null {
  // Try the leaf folder first
  const leafResult = extractVolumeNumber(path.basename(folderPath));
  if (leafResult) return leafResult;

  // Walk up to parent, then grandparent
  let current = path.dirname(folderPath);
  for (let i = 0; i < 2; i++) {
    // Don't walk above the download root
    const rel = path.relative(downloadRoot, current);
    if (!rel || rel === "." || rel.startsWith("..")) break;

    const result = extractVolumeNumber(path.basename(current));
    if (result) {
      console.log(
        `[IMPORT]   Fell back to ancestor folder "${path.basename(current)}" for volume number`,
      );
      return result;
    }
    current = path.dirname(current);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Step 3: Assign volume numbers with fallbacks and deduplication
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Duplicate volume resolution
// ---------------------------------------------------------------------------

const BATCH_RANGE_RE = /v(?:ol)?\.?\s*(\d+)\s*-\s*(\d+)/i;

/**
 * Parse the batch range from an ancestor folder name (e.g. "v01-07" → 7 volumes).
 * Returns the range size, or 0 if no range found.
 */
function parseBatchRange(folderPath: string): number {
  // Walk up from the volume folder looking for a batch range in ancestor names
  let current = path.dirname(folderPath);
  for (let i = 0; i < 3; i++) {
    const name = path.basename(current);
    if (!name || name === ".") break;
    const match = name.match(BATCH_RANGE_RE);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      return end - start + 1;
    }
    current = path.dirname(current);
  }
  return 0;
}

interface VolumeCandidate {
  volumeNumber: number;
  path: string;
  pattern: string;
  pageCount: number;
}

/**
 * Given multiple candidates for the same volume number, pick the best one.
 *
 * Priority:
 * 1. More pages (likely more complete scan)
 * 2. If within 5%, prefer wider batch range (newer/better source)
 * 3. If still tied, prefer 第XX巻 naming (more organized uploads)
 * 4. If still tied, first alphabetically by path
 */
function resolveDuplicate(candidates: VolumeCandidate[]): VolumeCandidate {
  const sorted = [...candidates].sort((a, b) => {
    // 1. More pages wins
    const pageDiff = b.pageCount - a.pageCount;
    const maxPages = Math.max(a.pageCount, b.pageCount);
    const withinThreshold =
      maxPages > 0 && Math.abs(pageDiff) / maxPages <= 0.05;

    if (!withinThreshold && pageDiff !== 0) return pageDiff;

    // 2. Wider batch range wins
    const rangeA = parseBatchRange(a.path);
    const rangeB = parseBatchRange(b.path);
    if (rangeA !== rangeB) return rangeB - rangeA;

    // 3. 第XX巻 pattern wins
    const aIsJapanese = a.pattern === "第XX巻";
    const bIsJapanese = b.pattern === "第XX巻";
    if (aIsJapanese !== bIsJapanese) return aIsJapanese ? -1 : 1;

    // 4. Alphabetical by path
    return a.path.localeCompare(b.path);
  });

  return sorted[0];
}

// ---------------------------------------------------------------------------
// Step 3: Assign volume numbers with fallbacks and duplicate resolution
// ---------------------------------------------------------------------------

function assignVolumeNumbers(
  folderPaths: string[],
  existingVolumes: number[],
  downloadRoot: string,
): { volumeNumber: number; path: string }[] {
  const existingSet = new Set(existingVolumes);
  const resolved: VolumeCandidate[] = [];
  const unresolved: string[] = [];

  // Extract volume numbers from folder names (with ancestor fallback)
  for (const fp of folderPaths) {
    const result = extractVolumeNumberWithAncestors(fp, downloadRoot);
    if (result) {
      console.log(
        `[IMPORT] Volume folder: ${path.basename(fp)} → volume ${result.number} (via ${result.pattern} pattern)`,
      );
      resolved.push({
        volumeNumber: result.number,
        path: fp,
        pattern: result.pattern,
        pageCount: findDirectImageFiles(fp).length,
      });
    } else {
      unresolved.push(fp);
    }
  }

  // Group by volume number and resolve duplicates
  const byNumber = new Map<number, VolumeCandidate[]>();
  for (const r of resolved) {
    const group = byNumber.get(r.volumeNumber) || [];
    group.push(r);
    byNumber.set(r.volumeNumber, group);
  }

  const deduplicated: VolumeCandidate[] = [];
  for (const [num, candidates] of byNumber) {
    if (candidates.length > 1) {
      const winner = resolveDuplicate(candidates);
      console.log(`[IMPORT] Duplicate volume ${num} found:`);
      for (const c of candidates) {
        const marker = c === winner ? "→ Selected" : "  Rejected";
        console.log(
          `[IMPORT]   ${marker}: ${path.basename(c.path)} (${c.pageCount} pages, pattern: ${c.pattern}, batch range: ${parseBatchRange(c.path) || "none"})`,
        );
      }
      deduplicated.push(winner);
    } else {
      deduplicated.push(candidates[0]);
    }
  }

  // Build final list: deduplicated minus already-imported
  const result: { volumeNumber: number; path: string }[] = [];
  for (const r of deduplicated) {
    if (existingSet.has(r.volumeNumber)) {
      console.log(
        `[IMPORT] Skipping v${String(r.volumeNumber).padStart(2, "0")} — already exists in target directory`,
      );
      continue;
    }
    result.push({ volumeNumber: r.volumeNumber, path: r.path });
  }

  // Handle unresolved folders
  if (unresolved.length > 0) {
    if (unresolved.length === folderPaths.length) {
      // ALL folders are unresolved — assign sequential numbers
      console.log(
        `[IMPORT] No volume numbers detected in any folder — assigning sequential numbers`,
      );
      const sorted = [...unresolved].sort((a, b) =>
        path.basename(a).localeCompare(path.basename(b)),
      );
      let nextNum = 1;
      for (const fp of sorted) {
        while (existingSet.has(nextNum)) nextNum++;
        console.log(
          `[IMPORT] Volume folder: ${path.basename(fp)} → assigned volume ${nextNum} (sequential fallback)`,
        );
        result.push({ volumeNumber: nextNum, path: fp });
        nextNum++;
      }
    } else if (resolved.length > 0 && unresolved.length === 1) {
      // One unresolved folder with some resolved — try next missing number
      const usedNumbers = new Set(result.map((r) => r.volumeNumber));
      let nextNum = 1;
      while (usedNumbers.has(nextNum) || existingSet.has(nextNum)) nextNum++;
      console.log(
        `[IMPORT] Volume folder: ${path.basename(unresolved[0])} → assigned volume ${nextNum} (single unresolved fallback)`,
      );
      result.push({ volumeNumber: nextNum, path: unresolved[0] });
    } else {
      // Multiple unresolved with some resolved — skip unresolved
      for (const fp of unresolved) {
        console.warn(
          `[IMPORT] WARNING: Could not extract volume number from folder: ${path.basename(fp)} — skipping`,
        );
      }
    }
  }

  return result.sort((a, b) => a.volumeNumber - b.volumeNumber);
}

// ---------------------------------------------------------------------------
// Step 4: Robust page sorting
// ---------------------------------------------------------------------------

type SortKey = [number, number | string];

/**
 * Detect and strip a common prefix shared by all filenames.
 *
 * Handles watermark prefixes like `DLRAW.TO_001.jpg` and concatenated names
 * like `yotuba13001.jpg`.
 *
 * Rules:
 * - If the common prefix ends with a separator (`_`, `-`, `.`, ` `), strip
 *   the entire prefix including the separator. This handles `DLRAW.TO_`.
 * - If the common prefix does NOT end with a separator, trim trailing digits
 *   and only strip if there's a non-empty alphabetical prefix remaining.
 *   This handles `yotuba13001` → strip `yotuba`, but does NOT strip `p`
 *   from `p0001` (single char with no separator is handled by parsePageSortKey).
 */
function detectCommonPrefix(names: string[]): string {
  if (names.length < 2) return "";

  // Find the common prefix of all names
  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    while (!names[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix.length === 0) return "";
    }
  }

  // If prefix ends with a separator, strip up to and including the separator
  if (/[_\-. ]$/.test(prefix)) {
    return prefix;
  }

  // Otherwise, trim trailing digits and check what's left
  const trimmed = prefix.replace(/\d+$/, "");
  // Only strip if there's a meaningful prefix (more than 1 char to avoid
  // stripping single-char prefixes like 'p' which are handled elsewhere)
  return trimmed.length > 1 ? trimmed : "";
}

/**
 * Parse a page filename into a sortable key: [primary_number, secondary].
 *
 * Handles patterns like:
 *   001          → [1, 0]
 *   000a, 000-a  → [0, "a"]
 *   004-005      → [4, 0]  (spread page)
 *   00-00        → [0, 0]
 *   p0001        → [1, 0]
 *   Yotsubato_v01_001 → [1, 0]  (last number group)
 */
function parsePageSortKey(filename: string, commonPrefix: string): SortKey {
  let name = path.parse(filename).name;

  // Strip common prefix (for concatenated names like yotuba13001)
  if (
    commonPrefix &&
    name.toLowerCase().startsWith(commonPrefix.toLowerCase())
  ) {
    name = name.slice(commonPrefix.length);
  }

  // Strip single-char prefix like 'p' if followed by digits
  name = name.replace(/^[a-zA-Z](?=\d)/, "");

  // Try to extract the page-relevant portion:
  // Take the LAST meaningful number group from the name.
  // Split by common separators: underscore, space
  const segments = name.split(/[_ ]+/);
  const pageSegment = segments[segments.length - 1] || name;

  // Parse the page segment into primary + secondary
  return parseSegment(pageSegment);
}

function parseSegment(segment: string): SortKey {
  // Pattern: number-letter (e.g. 000-a, 000a)
  const letterSuffix = segment.match(/^(\d+)-?([a-zA-Z])$/);
  if (letterSuffix) {
    return [parseInt(letterSuffix[1], 10), letterSuffix[2].toLowerCase()];
  }

  // Pattern: number-number (e.g. 004-005 spread page, or 00-01)
  const doubleDash = segment.match(/^(\d+)-(\d+)$/);
  if (doubleDash) {
    const first = parseInt(doubleDash[1], 10);
    const second = parseInt(doubleDash[2], 10);
    // If second > first by a lot, it's a spread page (004-005) — sort by first
    // If both are small or close, treat second as sub-sort (00-01, 00-02)
    if (second > first && second - first <= 2) {
      // Spread page like 004-005
      return [first, 0];
    }
    // Sub-page like 00-01, 00-02
    return [first, second];
  }

  // Pattern: plain number (e.g. 001, 0001)
  const plainNum = segment.match(/^(\d+)$/);
  if (plainNum) {
    return [parseInt(plainNum[1], 10), 0];
  }

  // Pattern: number followed by more digits with no separator (e.g. remaining
  // from concatenated names after prefix stripping) — just parse as number
  const anyNum = segment.match(/(\d+)/);
  if (anyNum) {
    return [parseInt(anyNum[1], 10), 0];
  }

  // No number found at all
  return [Infinity, 0];
}

function compareSortKeys(a: SortKey, b: SortKey): number {
  // Primary comparison
  if (a[0] !== b[0]) return a[0] - b[0];

  // Secondary comparison
  const sa = a[1];
  const sb = b[1];
  if (typeof sa === "number" && typeof sb === "number") return sa - sb;
  if (typeof sa === "string" && typeof sb === "string")
    return sa.localeCompare(sb);
  // Numbers sort before strings
  if (typeof sa === "number") return -1;
  return 1;
}

/**
 * Sort image files into correct reading order.
 * Falls back to lexicographic sort if parsed keys are mostly unusable.
 */
function sortImageFiles(files: string[]): string[] {
  if (files.length === 0) return [];

  const basenames = files.map((f) => path.parse(f).name);
  const commonPrefix = detectCommonPrefix(basenames);

  if (commonPrefix) {
    console.log(
      `[IMPORT]   Detected common filename prefix: "${commonPrefix}"`,
    );
  }

  // Parse sort keys for all files
  const keyed = files.map((f) => ({
    file: f,
    key: parsePageSortKey(path.basename(f), commonPrefix),
  }));

  // Check if most keys parsed successfully
  const infinityCount = keyed.filter((k) => k.key[0] === Infinity).length;
  if (infinityCount > files.length * 0.5) {
    console.log(
      `[IMPORT]   WARNING: ${infinityCount}/${files.length} filenames unparseable — using lexicographic sort`,
    );
    return [...files].sort((a, b) =>
      path.basename(a).localeCompare(path.basename(b)),
    );
  }

  keyed.sort((a, b) => {
    const cmp = compareSortKeys(a.key, b.key);
    // Tie-break with lexicographic on basename
    if (cmp === 0)
      return path.basename(a.file).localeCompare(path.basename(b.file));
    return cmp;
  });

  return keyed.map((k) => k.file);
}

// ---------------------------------------------------------------------------
// Step 5: Import a single volume to the library
// ---------------------------------------------------------------------------

function importVolume(
  sourcePath: string,
  mangaTitle: string,
  anilistId: number,
  volumeNumber: number,
): boolean {
  const volLabel = `v${String(volumeNumber).padStart(2, "0")}`;
  const targetDir = path.join(
    MANGA_DIR,
    `${mangaTitle} [anilist-${anilistId}]`,
    volLabel,
  );

  // Skip if target already exists
  if (fs.existsSync(targetDir)) {
    console.log(
      `[IMPORT] Skipping ${volLabel} — already exists in target directory`,
    );
    return true;
  }

  const imageFiles = findImageFiles(sourcePath);
  if (imageFiles.length === 0) {
    console.log(`[IMPORT] ${volLabel}: no image files found in ${sourcePath}`);
    return false;
  }

  const sorted = sortImageFiles(imageFiles);

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Dynamic zero-padding based on page count
  const padWidth = sorted.length >= 1000 ? 4 : 3;

  // Copy files with sequential naming
  for (let i = 0; i < sorted.length; i++) {
    const ext = path.extname(sorted[i]).toLowerCase();
    const newName = String(i + 1).padStart(padWidth, "0") + ext;
    fs.copyFileSync(sorted[i], path.join(targetDir, newName));
  }

  console.log(
    `[IMPORT] ${volLabel}: ${sorted.length} pages, sorted and renamed to ${volLabel}/001${path.extname(sorted[0]).toLowerCase()} - ${volLabel}/${String(sorted.length).padStart(padWidth, "0")}${path.extname(sorted[sorted.length - 1]).toLowerCase()}`,
  );

  return true;
}

// ---------------------------------------------------------------------------
// Step 6: Helper to get existing imported volume numbers for a manga
// ---------------------------------------------------------------------------

function getExistingVolumeNumbers(
  mangaTitle: string,
  anilistId: number,
): number[] {
  const mangaDir = path.join(MANGA_DIR, `${mangaTitle} [anilist-${anilistId}]`);
  if (!fs.existsSync(mangaDir)) return [];

  const entries = fs.readdirSync(mangaDir, { withFileTypes: true });
  const numbers: number[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^v(\d+)$/i);
    if (match) numbers.push(parseInt(match[1], 10));
  }
  return numbers;
}

// ---------------------------------------------------------------------------
// Download progress monitoring
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bulk download progress monitoring
// ---------------------------------------------------------------------------

export async function updateBulkDownloadProgress(): Promise<boolean> {
  const bulkMangaList = db
    .select()
    .from(managedManga)
    .where(isNotNull(managedManga.bulkTorrentId))
    .all();

  if (bulkMangaList.length === 0) return false;

  for (const manga of bulkMangaList) {
    if (!manga.bulkTorrentId) continue;

    try {
      const status = await getTorrentStatus(manga.bulkTorrentId);
      if (!status) continue;

      db.update(managedManga)
        .set({
          bulkProgress: Math.round(status.progress),
          bulkDownloadSpeed: status.downloadSpeed,
          updatedAt: new Date(),
        })
        .where(eq(managedManga.id, manga.id))
        .run();
    } catch (e) {
      console.error(
        `[MangaShelf] Bulk progress check failed for manga ${manga.id}:`,
        e,
      );
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Bulk download import
// ---------------------------------------------------------------------------

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

      console.log(`[IMPORT] Scanning: ${status.name}`);

      const extraction = extractIfNeeded(sourcePath);
      if (extraction.error) {
        console.error(
          `[IMPORT] Extraction failed for ${status.name}: ${extraction.error}`,
        );
        db.update(managedManga)
          .set({
            bulkTorrentId: null,
            bulkProgress: 0,
            bulkDownloadSpeed: 0,
            updatedAt: new Date(),
          })
          .where(eq(managedManga.id, manga.id))
          .run();
        failed++;
        continue;
      }

      try {
        const volumeFolderPaths = findVolumeFolders(extraction.importPath);
        console.log(
          `[IMPORT] Found ${volumeFolderPaths.length} volume folder(s)`,
        );

        if (volumeFolderPaths.length === 0) {
          console.warn(
            `[IMPORT] No volume folders detected in ${extraction.importPath}`,
          );
          db.update(managedManga)
            .set({
              bulkTorrentId: null,
              bulkProgress: 0,
              bulkDownloadSpeed: 0,
              updatedAt: new Date(),
            })
            .where(eq(managedManga.id, manga.id))
            .run();
          failed++;
          continue;
        }

        const existingVols = getExistingVolumeNumbers(title, manga.anilistId);
        const volumes = assignVolumeNumbers(
          volumeFolderPaths,
          existingVols,
          extraction.importPath,
        );

        let importedCount = 0;
        let skippedCount = 0;

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
              `[IMPORT] v${String(vol.volumeNumber).padStart(2, "0")} already imported in DB, skipping`,
            );
            skippedCount++;
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

          if (success) {
            db.update(managedVolume)
              .set({ status: "imported", updatedAt: new Date() })
              .where(eq(managedVolume.id, mv.id))
              .run();
            imported++;
            importedCount++;
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

        console.log(
          `[IMPORT] Complete: ${volumeFolderPaths.length} volumes processed, ${importedCount} imported, ${skippedCount} skipped`,
        );

        // Clear bulkTorrentId after processing
        db.update(managedManga)
          .set({
            bulkTorrentId: null,
            bulkProgress: 0,
            bulkDownloadSpeed: 0,
            updatedAt: new Date(),
          })
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
      db.update(managedManga)
        .set({
          bulkTorrentId: null,
          bulkProgress: 0,
          bulkDownloadSpeed: 0,
          updatedAt: new Date(),
        })
        .where(eq(managedManga.id, manga.id))
        .run();
      failed++;
    }
  }

  return { imported, failed };
}

// ---------------------------------------------------------------------------
// Single volume download import (with multi-volume detection)
// ---------------------------------------------------------------------------

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
        // Check if this "single volume" download actually contains multiple volumes
        const volumeFolderPaths = findVolumeFolders(extraction.importPath);

        if (volumeFolderPaths.length > 1) {
          // Multi-volume download detected — handle like a bulk import
          console.log(
            `[IMPORT] Single download contains ${volumeFolderPaths.length} volumes — importing as bulk`,
          );

          const existingVols = getExistingVolumeNumbers(title, manga.anilistId);
          const volumes = assignVolumeNumbers(
            volumeFolderPaths,
            existingVols,
            extraction.importPath,
          );

          let anySuccess = false;
          for (const v of volumes) {
            // Find or create managed_volume row for each detected volume
            let mv = db
              .select()
              .from(managedVolume)
              .where(
                and(
                  eq(managedVolume.managedMangaId, manga.id),
                  eq(managedVolume.volumeNumber, v.volumeNumber),
                ),
              )
              .get();

            if (mv?.status === "imported") continue;

            if (!mv) {
              mv = db
                .insert(managedVolume)
                .values({
                  managedMangaId: manga.id,
                  volumeNumber: v.volumeNumber,
                  status: "downloaded",
                })
                .returning()
                .get();
            }

            const success = importVolume(
              v.path,
              title,
              manga.anilistId,
              v.volumeNumber,
            );

            if (success) {
              db.update(managedVolume)
                .set({ status: "imported", updatedAt: new Date() })
                .where(eq(managedVolume.id, mv.id))
                .run();
              anySuccess = true;
              imported++;
            } else {
              db.update(managedVolume)
                .set({
                  status: "failed",
                  errorMessage: "No image files found",
                  updatedAt: new Date(),
                })
                .where(eq(managedVolume.id, mv.id))
                .run();
              failed++;
            }
          }

          // Mark the original volume entry as imported if any succeeded
          if (anySuccess) {
            db.update(managedVolume)
              .set({ status: "imported", updatedAt: new Date() })
              .where(eq(managedVolume.id, vol.id))
              .run();
            db.update(downloadHistory)
              .set({ status: "imported", updatedAt: new Date() })
              .where(eq(downloadHistory.managedVolumeId, vol.id))
              .run();
          }
        } else {
          // Truly single volume — import as before
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

// ---------------------------------------------------------------------------
// Background tasks
// ---------------------------------------------------------------------------

const PROGRESS_INTERVAL_FAST = 1_000; // 1s when downloads active
const PROGRESS_INTERVAL_SLOW = 5_000; // 5s when idle (cheap DB check only)

let progressTimer: ReturnType<typeof setTimeout> | null = null;
let importTimer: ReturnType<typeof setInterval> | null = null;
let _running = false;

async function progressTick(): Promise<void> {
  try {
    const downloading = db
      .select()
      .from(managedVolume)
      .where(eq(managedVolume.status, "downloading"))
      .all();

    const hasSingleDownloads = downloading.length > 0;
    if (hasSingleDownloads) {
      await updateDownloadProgress();
    }

    const hasBulkDownloads = await updateBulkDownloadProgress();
    const hasActive = hasSingleDownloads || hasBulkDownloads;

    const nextInterval = hasActive
      ? PROGRESS_INTERVAL_FAST
      : PROGRESS_INTERVAL_SLOW;

    if (_running) {
      progressTimer = setTimeout(progressTick, nextInterval);
    }
  } catch (e) {
    console.error("[MangaShelf] Progress tick error:", e);
    if (_running) {
      progressTimer = setTimeout(progressTick, PROGRESS_INTERVAL_SLOW);
    }
  }
}

export function startBackgroundTasks(): void {
  if (_running) return;
  _running = true;

  console.log(
    `[MangaShelf] Starting background tasks (progress: adaptive 1s/${DOWNLOAD_CHECK_INTERVAL / 1000}s, import: ${DOWNLOAD_CHECK_INTERVAL / 1000}s)`,
  );

  // Progress timer: adaptive speed (starts with a fast tick to detect state)
  progressTimer = setTimeout(progressTick, PROGRESS_INTERVAL_FAST);

  // Import timer: fixed interval for heavy I/O operations
  importTimer = setInterval(async () => {
    try {
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
      console.error("[MangaShelf] Import task error:", e);
    }
  }, DOWNLOAD_CHECK_INTERVAL);

  // Graceful shutdown
  const cleanup = () => {
    _running = false;
    if (progressTimer) clearTimeout(progressTimer);
    progressTimer = null;
    if (importTimer) clearInterval(importTimer);
    importTimer = null;
  };
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

/** @deprecated Use startBackgroundTasks instead */
export const startImportInterval = startBackgroundTasks;
