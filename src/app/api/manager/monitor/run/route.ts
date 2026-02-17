import { NextResponse } from "next/server";
import { refreshReleasingManga, runMonitoringCycle } from "@/lib/monitor";
import { requireAdmin } from "@/lib/auth-helpers";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
