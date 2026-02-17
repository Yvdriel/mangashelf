import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { checkSingleService } from "@/lib/system/service-checks";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name } = await params;

  if (!["deluge", "jackett", "anilist"].includes(name)) {
    return NextResponse.json(
      { error: `Unknown service: ${name}` },
      { status: 400 },
    );
  }

  const result = await checkSingleService(name);
  if (!result) {
    return NextResponse.json(
      { error: `Check failed for ${name}` },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
