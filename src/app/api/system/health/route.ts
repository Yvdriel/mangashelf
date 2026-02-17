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

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Use cached service results (no force)
  const services = await checkAllServices(false);
  const disk = getLibraryDiskInfo();
  const database = getDatabaseInfo();
  const staging = getStagingInfo();
  const dbStats = getDatabaseStats();

  const checks = runHealthChecks({
    services,
    disk,
    database,
    staging,
    dbStats,
  });

  const errors = checks.filter((c) => c.severity === "error").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;

  return NextResponse.json({
    checks,
    counts: { errors, warnings },
  });
}
