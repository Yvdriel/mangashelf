import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const THUMBS_DIR = path.join(MANGA_DIR, ".thumbnails");

const SIZE_CONFIG = {
  sm: { width: 200, quality: 75 },
  md: { width: 300, quality: 80 },
} as const;

type ThumbSize = keyof typeof SIZE_CONFIG;

function ensureThumbsDir() {
  if (!fs.existsSync(THUMBS_DIR)) {
    fs.mkdirSync(THUMBS_DIR, { recursive: true });
  }
}

function getThumbPath(sourcePath: string, size: ThumbSize): string {
  const hash = crypto
    .createHash("md5")
    .update(`${sourcePath}:${size}`)
    .digest("hex");
  return path.join(THUMBS_DIR, `${hash}.jpg`);
}

export async function getThumbnail(
  sourcePath: string,
  size: ThumbSize,
): Promise<Buffer | null> {
  const thumbPath = getThumbPath(sourcePath, size);

  if (fs.existsSync(thumbPath)) {
    return fs.readFileSync(thumbPath);
  }

  try {
    ensureThumbsDir();
    const config = SIZE_CONFIG[size];
    const buffer = await sharp(sourcePath)
      .resize({ width: config.width, withoutEnlargement: true })
      .jpeg({ quality: config.quality })
      .toBuffer();

    fs.writeFileSync(thumbPath, buffer);
    return buffer;
  } catch (err) {
    console.warn(
      `[MangaShelf] Thumbnail generation failed for ${sourcePath}:`,
      err,
    );
    return null;
  }
}
