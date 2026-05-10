import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth-helpers";
import { resolvePageImage } from "@/lib/image-resolver";

export const dynamic = "force-dynamic";

interface CaptureRequest {
  mangaId: number;
  volumeNumber: number;
  pageIdx: number;
  box: [number, number, number, number];
  padding: number;
  format: "png" | "jpeg";
  quality?: number;
}

function isCaptureRequest(value: unknown): value is CaptureRequest {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.mangaId !== "number") return false;
  if (typeof o.volumeNumber !== "number") return false;
  if (typeof o.pageIdx !== "number") return false;
  if (!Array.isArray(o.box) || o.box.length !== 4) return false;
  if (!o.box.every((n) => typeof n === "number")) return false;
  if (typeof o.padding !== "number" || o.padding < 0) return false;
  if (o.format !== "png" && o.format !== "jpeg") return false;
  if (
    o.quality !== undefined &&
    (typeof o.quality !== "number" || o.quality < 1 || o.quality > 100)
  ) {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isCaptureRequest(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { mangaId, volumeNumber, pageIdx, box, padding, format, quality } =
    body;

  const resolved = resolvePageImage(mangaId, volumeNumber, pageIdx);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error === "forbidden" ? "Forbidden" : "Not found" },
      { status: resolved.error === "forbidden" ? 403 : 404 },
    );
  }

  const image = sharp(resolved.value.filePath);
  let meta;
  try {
    meta = await image.metadata();
  } catch {
    return NextResponse.json({ error: "Unreadable image" }, { status: 500 });
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    return NextResponse.json({ error: "Image has no dimensions" }, { status: 500 });
  }

  const [x1, y1, x2, y2] = box;
  const left = Math.max(0, Math.floor(Math.min(x1, x2) - padding));
  const top = Math.max(0, Math.floor(Math.min(y1, y2) - padding));
  const right = Math.min(width, Math.ceil(Math.max(x1, x2) + padding));
  const bottom = Math.min(height, Math.ceil(Math.max(y1, y2) + padding));
  const cropW = Math.max(1, right - left);
  const cropH = Math.max(1, bottom - top);

  let buffer: Buffer;
  try {
    const pipeline = image.extract({
      left,
      top,
      width: cropW,
      height: cropH,
    });
    buffer = await (format === "png"
      ? pipeline.png().toBuffer()
      : pipeline.jpeg({ quality: quality ?? 85 }).toBuffer());
  } catch (err) {
    return NextResponse.json(
      {
        error: "Crop failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  const filename = `mangashelf-${mangaId}-v${volumeNumber}-p${pageIdx + 1}-${Date.now()}.${format === "png" ? "png" : "jpg"}`;

  return NextResponse.json({
    data: buffer.toString("base64"),
    filename,
    mime: format === "png" ? "image/png" : "image/jpeg",
    width: cropW,
    height: cropH,
  });
}
