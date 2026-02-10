import { NextResponse } from "next/server";
import { db } from "@/db";
import { readingProgress } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mangaId: string }> },
) {
  const { mangaId } = await params;
  const id = parseInt(mangaId, 10);

  const progress = db
    .select()
    .from(readingProgress)
    .where(eq(readingProgress.mangaId, id))
    .all();

  return NextResponse.json(progress);
}
