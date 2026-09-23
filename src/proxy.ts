import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

// Static brand assets (the login page's logo/illustration) served from
// `public/brand/*` — file requests only, not the `/brand` component-gallery
// page itself (which has no sub-paths, so this can't shadow a real route).
// Without this, /login's own images 307'd back to /login when signed out
// (flagged in the Phase 0 redesign audit, finding X15).
function isPublicBrandAsset(pathname: string) {
  return /^\/brand\/[^/]+\.(svg|png|jpg|jpeg)$/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    isPublicBrandAsset(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    // API routes answer 401 themselves; only pages redirect.
    if (pathname.startsWith("/api/")) return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Tell the server-side permission gate (lib/auth.ts) which path and method
  // it is serving. A server action POSTs to its own page, so this covers
  // pages, actions and API routes alike.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-pathname", pathname);
  forwarded.set("x-method", request.method);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
