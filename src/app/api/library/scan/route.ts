import { NextResponse } from "next/server";
import { syncLibrary } from "@/lib/scanner";
import { requireAdmin } from "@/lib/auth-helpers";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = syncLibrary();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Scan failed", details: String(error) },
      { status: 500 },
    );
  }
}
