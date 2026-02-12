import { NextRequest, NextResponse } from "next/server";
import { searchManga } from "@/lib/anilist";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.trim().length === 0) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchManga(query.trim());
    return NextResponse.json(results);
  } catch (e) {
    console.error("[Manager] AniList search error:", e);
    return NextResponse.json(
      { error: "Failed to search AniList" },
      { status: 500 },
    );
  }
}
