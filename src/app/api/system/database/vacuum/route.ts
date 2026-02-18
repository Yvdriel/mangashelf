import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import fs from "fs";

export const dynamic = "force-dynamic";

const DB_PATH = process.env.DATABASE_URL || "/data/mangashelf.db";

export async function POST() {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let beforeSize = 0;
  try {
    beforeSize = fs.statSync(DB_PATH).size;
  } catch {
    // Ignore
  }

  try {
    db.run(sql`VACUUM`);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "VACUUM failed" },
      { status: 500 },
    );
  }

  let afterSize = 0;
  try {
    afterSize = fs.statSync(DB_PATH).size;
  } catch {
    // Ignore
  }

  return NextResponse.json({
    success: true,
    beforeBytes: beforeSize,
    afterBytes: afterSize,
    savedBytes: beforeSize - afterSize,
  });
}
