import { NextResponse } from "next/server";
import { db } from "@/db";
import { managedManga } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCachedCover } from "@/lib/cover-cache";
import { getThumbnail } from "@/lib/thumbnails";
import fs from "fs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ anilistId: string }> },
) {
  const { anilistId } = await params;
  const id = parseInt(anilistId, 10);
  if (isNaN(id)) {
    return new NextResponse("Invalid ID", { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const thumbSize = searchParams.get("thumb") as "sm" | "md" | null;

  const managed = db
    .select({ coverImage: managedManga.coverImage })
    .from(managedManga)
    .where(eq(managedManga.anilistId, id))
    .get();

  if (!managed?.coverImage) {
    return new NextResponse("Not found", { status: 404 });
  }

  const coverPath = await getCachedCover(id, managed.coverImage);
  if (!coverPath) {
    return new NextResponse("Failed to fetch cover", { status: 502 });
  }

  if (thumbSize === "sm" || thumbSize === "md") {
    const thumbBuffer = await getThumbnail(coverPath, thumbSize);
    if (thumbBuffer) {
      return new NextResponse(new Uint8Array(thumbBuffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Length": thumbBuffer.length.toString(),
        },
      });
    }
  }

  const buffer = fs.readFileSync(coverPath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": buffer.length.toString(),
    },
  });
}
