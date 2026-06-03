import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";
import { buildVolumeCbz } from "@/lib/cbz";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; volumeNumber: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, volumeNumber } = await params;
  const mangaId = parseInt(id, 10);
  const volNum = parseInt(volumeNumber, 10);
  if (Number.isNaN(mangaId) || Number.isNaN(volNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = buildVolumeCbz(mangaId, volNum);
  if (!result.ok) {
    if (result.error === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { bytes, etag, filename } = result;

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private" },
    });
  }

  const body = new Uint8Array(bytes.length);
  body.set(bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": body.length.toString(),
      ETag: etag,
      "Cache-Control": "private",
    },
  });
}
