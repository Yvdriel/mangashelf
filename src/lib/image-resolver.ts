import fs from "fs";
import path from "path";
import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function parsePageNumber(filename: string): number {
  const name = path.parse(filename).name;
  const stripped = name.replace(/^_+/, "");
  return parseInt(stripped, 10);
}

export type ResolveError = "not-found" | "forbidden";

export interface ResolvedPage {
  filePath: string;
  filename: string;
  mime: string;
  ext: string;
}

export function resolvePageImage(
  mangaId: number,
  volumeNumber: number,
  pageIdx: number,
): { ok: true; value: ResolvedPage } | { ok: false; error: ResolveError } {
  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) return { ok: false, error: "not-found" };

  const vol = db
    .select()
    .from(volume)
    .where(and(eq(volume.mangaId, mangaId), eq(volume.volumeNumber, volumeNumber)))
    .get();
  if (!vol) return { ok: false, error: "not-found" };

  const pagesPath = path.join(MANGA_DIR, mangaData.folderName, vol.folderName);
  const resolved = path.resolve(pagesPath);
  if (!resolved.startsWith(path.resolve(MANGA_DIR))) {
    return { ok: false, error: "forbidden" };
  }
  if (!fs.existsSync(resolved)) return { ok: false, error: "not-found" };

  const files = fs
    .readdirSync(resolved)
    .filter(
      (f) =>
        !f.startsWith(".") &&
        IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()),
    )
    .sort((a, b) => parsePageNumber(a) - parsePageNumber(b));

  if (pageIdx < 0 || pageIdx >= files.length) {
    return { ok: false, error: "not-found" };
  }

  const filename = files[pageIdx];
  const filePath = path.join(resolved, filename);
  if (!fs.existsSync(filePath)) return { ok: false, error: "not-found" };

  const ext = path.extname(filename).toLowerCase();
  return {
    ok: true,
    value: {
      filePath,
      filename,
      ext,
      mime: MIME_TYPES[ext] ?? "application/octet-stream",
    },
  };
}
