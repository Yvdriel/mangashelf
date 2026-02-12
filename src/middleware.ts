import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionToken =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/setup");
  const isAuthAPI = pathname.startsWith("/api/auth");

  // Always allow auth API routes
  if (isAuthAPI) {
    return NextResponse.next();
  }

  // No session and not on auth page → redirect to login
  if (!sessionToken && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Has session and on auth page → redirect to home
  if (sessionToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)",
  ],
};
