import { NextResponse } from "next/server";
import { syncLibrary } from "@/lib/scanner";

export async function POST() {
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
