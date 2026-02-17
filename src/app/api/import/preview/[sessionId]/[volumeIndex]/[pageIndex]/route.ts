import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getImportSession } from "@/lib/import-session";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      sessionId: string;
      volumeIndex: string;
      pageIndex: string;
    }>;
  },
) {
  const session = await requireAdmin();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 403 });
  }

  const { sessionId, volumeIndex, pageIndex } = await params;
  const volIdx = parseInt(volumeIndex, 10);
  const pgIdx = parseInt(pageIndex, 10);

  if (isNaN(volIdx) || isNaN(pgIdx)) {
    return new NextResponse("Invalid parameters", { status: 400 });
  }

  const importSession = getImportSession(sessionId);
  if (!importSession?.analysis) {
    return new NextResponse("Session not found or not analyzed", {
      status: 404,
    });
  }

  const volume = importSession.analysis.volumes[volIdx];
  if (!volume) {
    return new NextResponse("Volume not found", { status: 404 });
  }

  // Find image files in the volume's source path
  const images = getImageFiles(volume.sourcePath);
  if (pgIdx >= images.length) {
    return new NextResponse("Page not found", { status: 404 });
  }

  const imagePath = images[pgIdx];

  if (!fs.existsSync(imagePath)) {
    return new NextResponse("Image file not found", { status: 404 });
  }

  try {
    // Resize to 200px wide for preview thumbnails
    const resized = await sharp(imagePath)
      .resize(200, null, { withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    return new NextResponse(new Uint8Array(resized), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "Content-Length": resized.length.toString(),
      },
    });
  } catch {
    // If sharp fails, serve the original file directly
    const fileBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const contentType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  }
}

function getImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter(
        (f) =>
          !f.startsWith(".") &&
          IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()),
      )
      .sort((a, b) => a.localeCompare(b))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}
