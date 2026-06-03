import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { manga } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/api-auth";
import { getThumbnail } from "@/lib/thumbnails";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const mangaId = parseInt(id, 10);
  if (Number.isNaN(mangaId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const size = searchParams.get("size") ?? "sm";
  if (size !== "sm" && size !== "md") {
    return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  }

  const row = db
    .select({ coverImage: manga.coverImage })
    .from(manga)
    .where(eq(manga.id, mangaId))
    .get();

  if (!row || !row.coverImage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourcePath = path.join(
    process.env.MANGA_DIR || "/manga",
    row.coverImage,
  );

  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(sourcePath).mtimeMs;
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const etag = `"cover-${mangaId}-${size}-${mtimeMs}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const thumbBuffer = await getThumbnail(sourcePath, size);
  if (!thumbBuffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(thumbBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": thumbBuffer.length.toString(),
      ETag: etag,
    },
  });
}
