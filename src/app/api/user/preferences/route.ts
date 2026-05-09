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

  return NextResponse.json({
    theme: prefs?.theme ?? "system",
    ocrEnabled: prefs?.ocrEnabled ?? false,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json(
      { error: "Body must be a JSON object" },
      { status: 400 },
    );
  }
  const body = parsed as Record<string, unknown>;

  const updates: Partial<{ theme: string; ocrEnabled: boolean }> = {};
  let themeForCookie: string | null = null;

  if ("theme" in body) {
    const { theme } = body;
    if (!theme || typeof theme !== "string" || !isThemePreference(theme)) {
      return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
    }
    updates.theme = theme;
    themeForCookie = theme;
  }

  if ("ocrEnabled" in body) {
    if (typeof body.ocrEnabled !== "boolean") {
      return NextResponse.json(
        { error: "ocrEnabled must be a boolean" },
        { status: 400 },
      );
    }
    updates.ocrEnabled = body.ocrEnabled;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No supported fields provided" },
      { status: 400 },
    );
  }

  db.insert(userPreferences)
    .values({
      userId: session.user.id,
      theme: updates.theme ?? "system",
      ocrEnabled: updates.ocrEnabled ?? false,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { ...updates, updatedAt: sql`(unixepoch())` },
    })
    .run();

  const current = db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .get();

  const response = NextResponse.json({
    theme: current?.theme ?? "system",
    ocrEnabled: current?.ocrEnabled ?? false,
  });

  if (themeForCookie) {
    response.cookies.set(THEME_COOKIE, themeForCookie, {
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
