import fs from "fs";
import path from "path";
import { zipSync } from "fflate";
import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function parsePageNumber(filename: string): number {
  const name = path.parse(filename).name;
  const stripped = name.replace(/^_+/, "");
  return parseInt(stripped, 10);
}

export type CbzError = "not-found" | "forbidden";

export type BuildVolumeCbzResult =
  | {
      ok: true;
      bytes: Uint8Array;
      pageCount: number;
      etag: string;
      filename: string;
    }
  | { ok: false; error: CbzError };

export function buildVolumeCbz(
  mangaId: number,
  volumeNumber: number,
): BuildVolumeCbzResult {
  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) return { ok: false, error: "not-found" };

  const vol = db
    .select()
    .from(volume)
    .where(
      and(eq(volume.mangaId, mangaId), eq(volume.volumeNumber, volumeNumber)),
    )
    .get();
  if (!vol) return { ok: false, error: "not-found" };

  const dir = path.join(MANGA_DIR, mangaData.folderName, vol.folderName);
  const resolved = path.resolve(dir);
  const root = path.resolve(MANGA_DIR);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
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

  const zipInput: Record<string, [Uint8Array, { level: 0 }]> = {};
  let maxMtimeMs = 0;
  files.forEach((file, idx) => {
    const filePath = path.join(resolved, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs > maxMtimeMs) maxMtimeMs = stat.mtimeMs;
    const ext = path.extname(file);
    const entryName = `${String(idx + 1).padStart(4, "0")}${ext}`;
    zipInput[entryName] = [new Uint8Array(fs.readFileSync(filePath)), { level: 0 }];
  });

  const bytes = zipSync(zipInput, { level: 0 });

  const pageCount = files.length;
  const etag = `vol-${vol.id}-${pageCount}-${Math.floor(maxMtimeMs)}`;
  const filename = `${mangaData.title} v${String(volumeNumber).padStart(2, "0")}.cbz`;

  return { ok: true, bytes, pageCount, etag, filename };
}
