import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// UX redirect layer — not a security boundary.
// Checks cookie existence to redirect unauthenticated users to /login and
// authenticated users away from auth pages. Does NOT validate tokens.
// All API routes independently validate sessions via getSession()/requireAdmin()
// with full database checks, so a fake cookie cannot access protected data.

export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  // Basic format check: token must be non-empty and reasonably sized
  const hasSession =
    sessionCookie?.value != null && sessionCookie.value.length >= 32;

  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/setup");
  const isAuthAPI = pathname.startsWith("/api/auth");

  // Always allow auth API routes
  if (isAuthAPI) {
    return NextResponse.next();
  }

  // No valid session cookie and not on auth page → redirect to login
  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Has session cookie and on auth page → redirect to home
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)",
  ],
};
