import { NextResponse } from "next/server";
import { db } from "@/db";
import { readingProgress, volume } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getRequiredSession } from "@/lib/auth-helpers";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ mangaId: string; volumeId: string }> },
) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mangaId, volumeId } = await params;
  const mId = parseInt(mangaId, 10);
  const vId = parseInt(volumeId, 10);
  const body = await request.json();
  const { currentPage } = body as { currentPage: number };

  // Determine if completed: check if currentPage is the last page
  const vol = db.select().from(volume).where(eq(volume.id, vId)).get();
  const isCompleted = vol ? currentPage >= vol.pageCount - 1 : false;

  const existing = db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.userId, session.user.id),
        eq(readingProgress.mangaId, mId),
        eq(readingProgress.volumeId, vId),
      ),
    )
    .get();

  if (existing) {
    db.update(readingProgress)
      .set({
        currentPage,
        isCompleted,
        lastReadAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(readingProgress.id, existing.id))
      .run();
  } else {
    db.insert(readingProgress)
      .values({
        userId: session.user.id,
        mangaId: mId,
        volumeId: vId,
        currentPage,
        isCompleted,
      })
      .run();
  }

  return NextResponse.json({ success: true, isCompleted });
}
