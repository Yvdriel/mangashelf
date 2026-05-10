import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { findCatalogEntry } from "@/lib/dict/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams the upstream dictionary ZIP to the client. The client unzips and
// indexes inside its Web Worker; the server only proxies (avoids CORS and
// shields the user from upstream availability hiccups via Next's fetch
// retry/redirect behavior).
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
  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const entry = findCatalogEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Unknown dictionary" }, { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(entry.url, {
      redirect: "follow",
      // Prevent Next caching the binary at the edge.
      cache: "no-store",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream fetch failed" },
      { status: 502 },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: 502 },
    );
  }

  const headers = new Headers({
    "content-type": "application/zip",
    "x-dict-id": entry.id,
    "cache-control": "no-store",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);

  return new Response(upstream.body, { headers });
}
