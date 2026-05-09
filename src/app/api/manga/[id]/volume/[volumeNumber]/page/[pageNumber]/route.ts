import { NextResponse } from "next/server";
import fs from "fs";
import { getSession } from "@/lib/auth-helpers";
import { getThumbnail } from "@/lib/thumbnails";
import { resolvePageImage } from "@/lib/image-resolver";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; volumeNumber: string; pageNumber: string }>;
  },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id, volumeNumber, pageNumber } = await params;
  const { searchParams } = new URL(request.url);
  const thumbSize = searchParams.get("thumb") as "sm" | "md" | null;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);
  const pageIdx = parseInt(pageNumber, 10);

  const result = resolvePageImage(mangaId, volNum, pageIdx);
  if (!result.ok) {
    if (result.error === "forbidden") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    return new NextResponse("Not found", { status: 404 });
  }
  const { filePath, mime } = result.value;

  if (thumbSize === "sm" || thumbSize === "md") {
    const thumbBuffer = await getThumbnail(filePath, thumbSize);
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

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": fileBuffer.length.toString(),
    },
  });
}
