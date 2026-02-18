import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth-helpers";
import {
  isThemePreference,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
} from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .get();

  return NextResponse.json({ theme: prefs?.theme ?? "system" });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { theme } = body;
  if (!theme || typeof theme !== "string" || !isThemePreference(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  db.insert(userPreferences)
    .values({ userId: session.user.id, theme })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { theme, updatedAt: sql`(unixepoch())` },
    })
    .run();

  const response = NextResponse.json({ theme });
  response.cookies.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
