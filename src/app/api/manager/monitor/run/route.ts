import { NextResponse } from "next/server";
import { refreshReleasingManga, runMonitoringCycle } from "@/lib/monitor";

export async function POST() {
  try {
    const newVolumes = await refreshReleasingManga();
    const result = await runMonitoringCycle();
    return NextResponse.json({ ...result, newVolumesDetected: newVolumes });
  } catch (e) {
    console.error("[Monitor] Manual run failed:", e);
    return NextResponse.json(
      { error: "Monitoring cycle failed" },
      { status: 500 },
    );
  }
}
