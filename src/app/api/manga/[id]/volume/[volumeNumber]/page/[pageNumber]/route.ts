import { NextResponse } from "next/server";
import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";

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

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; volumeNumber: string; pageNumber: string }>;
  },
) {
  const { id, volumeNumber, pageNumber } = await params;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);
  const pageIdx = parseInt(pageNumber, 10);

  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) {
    return new NextResponse("Not found", { status: 404 });
  }

  const vol = db
    .select()
    .from(volume)
    .where(and(eq(volume.mangaId, mangaId), eq(volume.volumeNumber, volNum)))
    .get();

  if (!vol) {
    return new NextResponse("Volume not found", { status: 404 });
  }

  const pagesPath = path.join(MANGA_DIR, mangaData.folderName, vol.folderName);
  const resolved = path.resolve(pagesPath);

  if (!resolved.startsWith(path.resolve(MANGA_DIR))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const files = fs
    .readdirSync(resolved)
    .filter(
      (f) =>
        !f.startsWith(".") &&
        IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()),
    )
    .sort((a, b) => parsePageNumber(a) - parsePageNumber(b));

  if (pageIdx < 0 || pageIdx >= files.length) {
    return new NextResponse("Page not found", { status: 404 });
  }

  const filename = files[pageIdx];
  const filePath = path.join(resolved, filename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("File not found", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": fileBuffer.length.toString(),
    },
  });
}
