import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/setup");
  const isAuthAPI = pathname.startsWith("/api/auth");

  // Always allow auth API routes
  if (isAuthAPI) {
    return NextResponse.next();
  }

  // Fast path: no cookie at all → skip DB validation
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    if (!isAuthPage) {
      const result = db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .get();
      const hasUsers = (result?.count ?? 0) > 0;
      return NextResponse.redirect(
        new URL(hasUsers ? "/login" : "/setup", request.url),
      );
    }
    return NextResponse.next();
  }

  // Cookie exists — validate session against the database
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session && !isAuthPage) {
    // Expired/invalid session → redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isAuthPage) {
    // Valid session on auth page → redirect to home
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js|api/import/upload).*)",
  ],
};
