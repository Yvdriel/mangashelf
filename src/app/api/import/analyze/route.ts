import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { extractIfNeeded } from "@/lib/extractor";
import {
  findVolumeFolders,
  findDirectImageFiles,
  extractVolumeNumberWithAncestors,
  getExistingVolumeNumbers,
} from "@/lib/importer";
import { searchManga } from "@/lib/anilist";
import {
  createSession,
  getImportSession,
  updateSession,
} from "@/lib/import-session";
import type {
  ImportAnalysis,
  DetectedVolume,
  ImportWarning,
} from "@/lib/import-types";

export const dynamic = "force-dynamic";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const MANGA_FOLDER_RE = /^(.+?)\s*\[anilist-(\d+)\]$/;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function calculateDirSize(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        total += calculateDirSize(fullPath);
      }
    }
  } catch {
    // ignore permission errors
  }
  return total;
}

function tryParseTitleFromPath(sourcePath: string): string | null {
  // Walk up from the source path trying to find a reasonable title
  // Strip archive/image extensions first
  const basename = path
    .basename(sourcePath)
    .replace(/\.(zip|rar|7z|cbz|cbr|tar|gz|jpg|jpeg|png|webp)$/i, "");

  // Strip common prefixes like [Group] or (stuff)
  let title = basename
    .replace(/^\[.*?\]\s*/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .trim();

  // Strip site-name prefixes like "DLraw.net-", "Manga1000.com_", "site.co.jp - "
  title = title.replace(/^\S+\.\w{2,}\s*[-_]\s*/, "").trim();

  // Remove volume indicators (vol 01, v01, vol 01-15, 第1巻, etc.)
  title = title
    .replace(/v(?:ol(?:ume)?)?\.?\s*\d+[\d\s.~-]*$/i, "")
    .replace(/第\d+巻.*$/, "")
    .trim();

  // Remove trailing separators
  title = title.replace(/[-_]+$/, "").trim();

  return title || null;
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { sourcePath, sessionId: existingSessionId } = body as {
    sourcePath: string;
    sessionId?: string;
  };

  if (!sourcePath) {
    return NextResponse.json(
      { error: "sourcePath is required" },
      { status: 400 },
    );
  }

  if (!fs.existsSync(sourcePath)) {
    return NextResponse.json(
      { error: "Source path does not exist" },
      { status: 404 },
    );
  }

  // Get or create import session
  let importSession = existingSessionId
    ? getImportSession(existingSessionId)
    : undefined;

  if (!importSession) {
    importSession = createSession();
  }

  updateSession(importSession.id, { status: "analyzing" });

  try {
    // Extract archives if needed
    const extraction = extractIfNeeded(sourcePath);
    if (extraction.error) {
      const warnings: ImportWarning[] = [
        {
          type: "archive_extraction_failed",
          message: `Archive extraction failed: ${extraction.error}`,
        },
      ];
      const analysis: ImportAnalysis = {
        sessionId: importSession.id,
        sourcePath,
        detectedType: "unknown",
        volumes: [],
        warnings,
      };
      updateSession(importSession.id, {
        status: "ready",
        analysis,
        extractionTempDir: null,
      });
      return NextResponse.json(analysis);
    }

    // Store extraction temp dir for later cleanup
    updateSession(importSession.id, {
      extractionTempDir: extraction.tempDir,
    });

    const importPath = extraction.importPath;

    // Discover volume folders
    const volumeFolderPaths = findVolumeFolders(importPath);

    const warnings: ImportWarning[] = [];
    const volumes: DetectedVolume[] = [];

    if (volumeFolderPaths.length === 0) {
      warnings.push({
        type: "no_images_found",
        message: "No importable volumes found in the selected folder",
      });
    }

    // Try to guess existing manga title/anilistId from the library
    // to check for duplicates
    let guessedTitle: string | null = null;
    let guessedAnilistId: number | null = null;

    // Check if sourcePath matches a known manga folder pattern
    const folderMatch = path.basename(sourcePath).match(MANGA_FOLDER_RE);
    if (folderMatch) {
      guessedTitle = folderMatch[1].trim();
      guessedAnilistId = parseInt(folderMatch[2], 10);
    }

    // For uploads: the staging directory name is a UUID, so derive the
    // title from the original uploaded filenames instead
    if (!guessedTitle && existingSessionId) {
      try {
        const entries = fs.readdirSync(sourcePath);
        for (const entry of entries) {
          const parsed = tryParseTitleFromPath(entry);
          if (parsed) {
            guessedTitle = parsed;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    // Get existing volumes for duplicate detection
    let existingVolumeNumbers: number[] = [];
    let existingVolumeCounts: Map<number, number> | null = null;

    if (guessedTitle && guessedAnilistId) {
      existingVolumeNumbers = getExistingVolumeNumbers(
        guessedTitle,
        guessedAnilistId,
      );
      // Get page counts for existing volumes
      existingVolumeCounts = new Map();
      const mangaDir = path.join(
        MANGA_DIR,
        `${guessedTitle} [anilist-${guessedAnilistId}]`,
      );
      for (const volNum of existingVolumeNumbers) {
        const volDir = path.join(
          mangaDir,
          `v${String(volNum).padStart(2, "0")}`,
        );
        try {
          const pages = fs
            .readdirSync(volDir)
            .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
          existingVolumeCounts.set(volNum, pages.length);
        } catch {
          existingVolumeCounts.set(volNum, 0);
        }
      }
    }

    // Analyze each volume folder
    for (let i = 0; i < volumeFolderPaths.length; i++) {
      const volPath = volumeFolderPaths[i];
      const volId = crypto.randomUUID();

      const images = findDirectImageFiles(volPath);
      const pageCount = images.length;
      const totalSizeBytes = calculateDirSize(volPath);

      const volNumResult = extractVolumeNumberWithAncestors(
        volPath,
        importPath,
      );
      const detectedVolumeNumber = volNumResult?.number ?? null;

      const existsInLibrary =
        detectedVolumeNumber !== null &&
        existingVolumeNumbers.includes(detectedVolumeNumber);

      const existingPageCount =
        existsInLibrary && existingVolumeCounts
          ? (existingVolumeCounts.get(detectedVolumeNumber!) ?? undefined)
          : undefined;

      // Generate preview page URLs (first 3 pages)
      const previewPages: string[] = [];
      const sortedPreviewImages = images
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
        .slice(0, 3);
      for (let j = 0; j < sortedPreviewImages.length; j++) {
        previewPages.push(`/api/import/preview/${importSession.id}/${i}/${j}`);
      }

      const volume: DetectedVolume = {
        id: volId,
        sourcePath: volPath,
        detectedVolumeNumber,
        pageCount,
        totalSizeBytes,
        previewPages,
        existsInLibrary,
        existingPageCount,
        sourceLabel: path.basename(volPath),
      };

      volumes.push(volume);

      // Add warnings
      if (detectedVolumeNumber === null) {
        warnings.push({
          type: "no_volume_number",
          message: `Could not detect volume number for "${path.basename(volPath)}"`,
          volumeId: volId,
        });
      }

      if (pageCount === 0) {
        warnings.push({
          type: "no_images_found",
          message: `No image files found in "${path.basename(volPath)}"`,
          volumeId: volId,
        });
      } else if (pageCount < 10) {
        warnings.push({
          type: "low_page_count",
          message: `Only ${pageCount} pages in "${path.basename(volPath)}" — this might not be a complete volume`,
          volumeId: volId,
        });
      }

      if (existsInLibrary) {
        warnings.push({
          type: "duplicate_volume",
          message: `Volume ${detectedVolumeNumber} already exists in library (${existingPageCount ?? "?"} pages)`,
          volumeId: volId,
        });
      }
    }

    // Detect type: single manga vs multiple
    const detectedType: ImportAnalysis["detectedType"] =
      volumes.length === 0
        ? "unknown"
        : volumes.length === 1
          ? "single_manga"
          : "single_manga"; // Most cases — multiple volumes of one manga

    // Try to find an AniList match from folder name
    let suggestedMatch: ImportAnalysis["suggestedMatch"] = undefined;
    const titleGuess = guessedTitle || tryParseTitleFromPath(sourcePath);

    // Only auto-select an AniList match when the folder has a confirmed
    // [anilist-ID] tag. Otherwise, pass the titleGuess so the UI can
    // open AniList search with it pre-filled and let the user pick.
    if (titleGuess && guessedAnilistId) {
      try {
        const results = await searchManga(titleGuess);
        if (results.length > 0) {
          const best = results[0];
          suggestedMatch = {
            anilistId: best.id,
            title:
              best.title.romaji ||
              best.title.english ||
              best.title.native ||
              titleGuess,
            coverUrl: best.coverImage.extraLarge || best.coverImage.large || "",
            totalVolumes: best.volumes,
          };
        }
      } catch {
        // AniList search failed — not critical
      }
    }

    const analysis: ImportAnalysis = {
      sessionId: importSession.id,
      sourcePath,
      detectedType,
      volumes,
      warnings,
      suggestedMatch,
      titleGuess: titleGuess || undefined,
    };

    updateSession(importSession.id, { status: "ready", analysis });

    return NextResponse.json(analysis);
  } catch (e) {
    updateSession(importSession.id, { status: "failed" });
    return NextResponse.json(
      { error: `Analysis failed: ${e}` },
      { status: 500 },
    );
  }
}
