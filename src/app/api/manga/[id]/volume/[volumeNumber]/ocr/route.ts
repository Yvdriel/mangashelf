import { NextResponse } from "next/server";
import fs from "fs";
import { getSession } from "@/lib/auth-helpers";
import { resolveMokuroFile } from "@/lib/ocr";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; volumeNumber: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, volumeNumber } = await params;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);
  if (Number.isNaN(mangaId) || Number.isNaN(volNum)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const resolved = resolveMokuroFile(mangaId, volNum);
  if (!resolved) {
    return NextResponse.json(
      { error: "OCR not available for this volume" },
      { status: 404 },
    );
  }

  let raw: string;
  try {
    raw = fs.readFileSync(resolved.absolutePath, "utf8");
  } catch {
    return NextResponse.json(
      { error: "Failed to read OCR file" },
      { status: 500 },
    );
  }

  return new NextResponse(raw, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
