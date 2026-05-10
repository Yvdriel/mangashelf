import { NextResponse } from "next/server";
import { db } from "@/db";
import { manga } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth-helpers";
import { enqueueOcrForManga, getMangaOcrSummary } from "@/lib/ocr";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const mangaId = parseInt(id, 10);
  if (Number.isNaN(mangaId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const exists = db
    .select({ id: manga.id })
    .from(manga)
    .where(eq(manga.id, mangaId))
    .get();
  if (!exists) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  return NextResponse.json(getMangaOcrSummary(mangaId));
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const mangaId = parseInt(id, 10);
  if (Number.isNaN(mangaId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const exists = db
    .select({ id: manga.id })
    .from(manga)
    .where(eq(manga.id, mangaId))
    .get();
  if (!exists) {
    return NextResponse.json({ error: "Manga not found" }, { status: 404 });
  }

  const result = enqueueOcrForManga(mangaId, "low");
  const summary = getMangaOcrSummary(mangaId);
  return NextResponse.json({ ...result, summary });
}
