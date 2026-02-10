import fs from "fs";
import path from "path";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const COVERS_DIR = path.join(MANGA_DIR, ".covers");

function ensureCoversDir() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }
}

function getCoverPath(anilistId: number): string {
  return path.join(COVERS_DIR, `${anilistId}.jpg`);
}

export function getCachedCoverPath(anilistId: number): string | null {
  const coverPath = getCoverPath(anilistId);
  if (fs.existsSync(coverPath)) {
    return coverPath;
  }
  return null;
}

export async function getCachedCover(
  anilistId: number,
  url: string,
): Promise<string | null> {
  const coverPath = getCoverPath(anilistId);

  if (fs.existsSync(coverPath)) {
    return coverPath;
  }

  try {
    ensureCoversDir();
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(coverPath, buffer);
    return coverPath;
  } catch (err) {
    console.warn(
      `[MangaShelf] Failed to cache cover for anilist ${anilistId}:`,
      err,
    );
    return null;
  }
}
