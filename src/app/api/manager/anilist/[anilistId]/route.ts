import { NextResponse } from "next/server";
import { getMangaDetail } from "@/lib/anilist";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ anilistId: string }> },
) {
  const { anilistId } = await params;
  const id = parseInt(anilistId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid AniList ID" }, { status: 400 });
  }

  try {
    const detail = await getMangaDetail(id);
    return NextResponse.json(detail);
  } catch (e) {
    console.error("[Manager] AniList detail error:", e);
    return NextResponse.json(
      { error: "Failed to fetch from AniList" },
      { status: 500 },
    );
  }
}
