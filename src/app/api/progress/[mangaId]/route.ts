import { NextResponse } from "next/server";
import { db } from "@/db";
import { readingProgress } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth-helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mangaId: string }> },
) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mangaId } = await params;
  const id = parseInt(mangaId, 10);

  const progress = db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.mangaId, id),
        eq(readingProgress.userId, session.user.id),
      ),
    )
    .all();

  return NextResponse.json(progress);
}
