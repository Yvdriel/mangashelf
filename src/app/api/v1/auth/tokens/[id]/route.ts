import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiToken } from "@/db/schema";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const owned = db
    .select({ id: apiToken.id })
    .from(apiToken)
    .where(and(eq(apiToken.id, id), eq(apiToken.userId, session.user.id)))
    .get();

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.update(apiToken)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiToken.id, id),
        eq(apiToken.userId, session.user.id),
        isNull(apiToken.revokedAt),
      ),
    )
    .run();

  return NextResponse.json({ success: true });
}
