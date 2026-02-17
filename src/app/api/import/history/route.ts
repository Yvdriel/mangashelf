import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/db";
import { importHistory, importHistoryVolume } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const history = db
    .select()
    .from(importHistory)
    .orderBy(desc(importHistory.createdAt))
    .limit(50)
    .all();

  const result = history.map((h) => {
    const volumes = db
      .select()
      .from(importHistoryVolume)
      .where(eq(importHistoryVolume.importId, h.id))
      .all();

    return {
      ...h,
      volumes,
    };
  });

  return NextResponse.json(result);
}
