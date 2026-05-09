import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { lookupText } from "@/lib/dict/lookup";

export const dynamic = "force-dynamic";

const MAX_LEN = 200;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const text = (body as { text?: unknown }).text;
  if (typeof text !== "string") {
    return NextResponse.json(
      { error: "`text` must be a string" },
      { status: 400 },
    );
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return NextResponse.json({ tokens: [] });
  }
  if (trimmed.length > MAX_LEN) {
    return NextResponse.json(
      { error: `Text too long (max ${MAX_LEN} chars)` },
      { status: 400 },
    );
  }

  try {
    const result = await lookupText(trimmed);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[dict/lookup] failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Lookup failed",
      },
      { status: 500 },
    );
  }
}
