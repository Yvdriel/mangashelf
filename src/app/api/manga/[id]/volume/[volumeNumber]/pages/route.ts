import { NextResponse } from "next/server";
import { db } from "@/db";
import { manga, volume } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth-helpers";
import fs from "fs";
import path from "path";

const MANGA_DIR = process.env.MANGA_DIR || "/manga";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function parsePageNumber(filename: string): number {
  const name = path.parse(filename).name;
  const stripped = name.replace(/^_+/, "");
  return parseInt(stripped, 10);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; volumeNumber: string }> },
) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, volumeNumber } = await params;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);

  const mangaData = db.select().from(manga).where(eq(manga.id, mangaId)).get();
  if (!mangaData) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  const vol = db
    .select()
    .from(volume)
    .where(and(eq(volume.mangaId, mangaId), eq(volume.volumeNumber, volNum)))
    .get();

  if (!vol) {
    return NextResponse.json({ error: "Volume not found" }, { status: 404 });
  }

  const pagesPath = path.join(MANGA_DIR, mangaData.folderName, vol.folderName);

  if (!fs.existsSync(pagesPath)) {
    return NextResponse.json(
      { error: "Volume directory not found on disk" },
      { status: 404 },
    );
  }

  const files = fs
    .readdirSync(pagesPath)
    .filter(
      (f) =>
        !f.startsWith(".") &&
        IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()),
    )
    .sort((a, b) => parsePageNumber(a) - parsePageNumber(b));

  const pages = files.map((filename, index) => ({
    index,
    filename,
    url: `/api/manga/${mangaId}/volume/${volNum}/page/${index}`,
  }));

  return NextResponse.json({
    mangaId,
    volumeNumber: volNum,
    volumeId: vol.id,
    pageCount: pages.length,
    pages,
  });
}
