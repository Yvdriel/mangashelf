import { NextResponse } from "next/server";
import { monitorSingleManga } from "@/lib/monitor";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mangaId = parseInt(id, 10);

  try {
    const result = await monitorSingleManga(mangaId);
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[Monitor] Manual check failed for manga ${mangaId}:`, e);
    return NextResponse.json(
      { error: "Monitoring check failed" },
      { status: 500 },
    );
  }
}
