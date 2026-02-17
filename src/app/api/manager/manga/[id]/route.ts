import { NextResponse } from "next/server";
import { db } from "@/db";
import { managedManga, managedVolume } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const mangaId = parseInt(id, 10);

  const manga = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!manga) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const volumes = db
    .select()
    .from(managedVolume)
    .where(eq(managedVolume.managedMangaId, mangaId))
    .orderBy(managedVolume.volumeNumber)
    .all();

  return NextResponse.json({
    ...manga,
    synonyms: JSON.parse(manga.synonyms || "[]"),
    genres: JSON.parse(manga.genres || "[]"),
    volumes,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const mangaId = parseInt(id, 10);

  const existing = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.delete(managedManga).where(eq(managedManga.id, mangaId)).run();

  return NextResponse.json({ success: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const mangaId = parseInt(id, 10);
  const body = await request.json();

  const existing = db
    .select()
    .from(managedManga)
    .where(eq(managedManga.id, mangaId))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.monitored === "boolean") {
    updates.monitored = body.monitored;
  }

  db.update(managedManga)
    .set(updates)
    .where(eq(managedManga.id, mangaId))
    .run();

  return NextResponse.json({ success: true });
}
