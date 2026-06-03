import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiToken } from "@/db/schema";
import {
  generateToken,
  getSessionFromRequest,
  hashToken,
  tokenPrefix,
} from "@/lib/api-auth";

const toSeconds = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      prefix: apiToken.prefix,
      lastUsedAt: apiToken.lastUsedAt,
      createdAt: apiToken.createdAt,
      revokedAt: apiToken.revokedAt,
    })
    .from(apiToken)
    .where(eq(apiToken.userId, session.user.id))
    .all();

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      lastUsedAt: toSeconds(r.lastUsedAt),
      createdAt: toSeconds(r.createdAt),
      revokedAt: toSeconds(r.revokedAt),
    })),
  );
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const plain = generateToken();
  const id = randomUUID();

  db.insert(apiToken)
    .values({
      id,
      userId: session.user.id,
      name,
      tokenHash: hashToken(plain),
      prefix: tokenPrefix(plain),
    })
    .run();

  return NextResponse.json(
    { id, name, token: plain, prefix: tokenPrefix(plain) },
    { status: 201 },
  );
}
