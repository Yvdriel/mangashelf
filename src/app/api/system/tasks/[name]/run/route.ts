import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { triggerTask } from "@/lib/background/task-registry";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await params;

  const result = await triggerTask(name);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: `Task "${name}" started`,
  });
}
