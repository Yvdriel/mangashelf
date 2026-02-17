import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { checkAllServices } from "@/lib/system/service-checks";
import {
  getLibraryDiskInfo,
  getDatabaseInfo,
  getStagingInfo,
} from "@/lib/system/disk";
import { getDatabaseStats } from "@/lib/system/db-stats";
import { runHealthChecks } from "@/lib/system/health-checks";
import { getTaskStates } from "@/lib/background/task-registry";
import { getSystemInfo } from "@/lib/system/system-info";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  // Run service checks (async) in parallel with synchronous data gathering
  const [services] = await Promise.all([checkAllServices(force)]);
  const disk = getLibraryDiskInfo();
  const database = getDatabaseInfo();
  const staging = getStagingInfo();
  const dbStats = getDatabaseStats();
  const tasks = getTaskStates();
  const system = getSystemInfo();

  const health = runHealthChecks({
    services,
    disk,
    database,
    staging,
    dbStats,
  });

  return NextResponse.json({
    services,
    disk: {
      library: disk,
      database,
      staging,
      downloads:
        services.deluge.details?.freeBytes != null
          ? { freeBytes: services.deluge.details.freeBytes }
          : undefined,
    },
    database: dbStats,
    tasks,
    system,
    health,
  });
}
