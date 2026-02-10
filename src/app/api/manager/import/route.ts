import { NextResponse } from "next/server";
import { checkAndImportDownloads } from "@/lib/importer";

export async function POST() {
  try {
    const result = await checkAndImportDownloads();
    return NextResponse.json(result);
  } catch (e) {
    console.error("[Manager] Manual import error:", e);
    return NextResponse.json({ error: "Import check failed" }, { status: 500 });
  }
}
