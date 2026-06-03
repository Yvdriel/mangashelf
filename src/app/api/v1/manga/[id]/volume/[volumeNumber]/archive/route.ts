import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";
import { buildVolumeCbz } from "@/lib/cbz";
import { ifNoneMatchSatisfied } from "@/lib/http";

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

  if (ifNoneMatchSatisfied(request.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private" },
    });
  }

  // Keep the header well-formed: strip quotes/control chars for the ASCII
  // fallback, and carry the real (possibly non-ASCII) title via filename*.
  const asciiName =
    filename.replace(/["\\\r\n]/g, "").replace(/[^\x20-\x7e]/g, "_") ||
    "volume.cbz";
  const disposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
    filename,
  )}`;

  // fflate types its output as Uint8Array<ArrayBufferLike>; it is ArrayBuffer-
  // backed at runtime, so this is a valid copy-free BodyInit. The cast only
  // bridges the over-narrow lib typing — no allocation, unlike copying the buffer.
  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disposition,
      "Content-Length": bytes.byteLength.toString(),
      ETag: etag,
      "Cache-Control": "private",
    },
  });
}
