import { NextResponse } from "next/server";
import {
  checkAndImportDownloads,
  checkAndImportBulkDownloads,
} from "@/lib/importer";

export async function POST() {
  try {
    const bulk = await checkAndImportBulkDownloads();
    const single = await checkAndImportDownloads();
    return NextResponse.json({
      imported: bulk.imported + single.imported,
      failed: bulk.failed + single.failed,
    });
  } catch (e) {
    console.error("[Manager] Manual import error:", e);
    return NextResponse.json({ error: "Import check failed" }, { status: 500 });
  }
}
