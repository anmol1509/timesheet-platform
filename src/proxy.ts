import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/session";
import { ESS_COOKIE, verifyEssToken } from "@/lib/ess/token";
import { VENDOR_COOKIE, verifyVendorToken } from "@/lib/vendor/token";

const PUBLIC_PATHS = ["/login", "/welcome"];

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

  // The marketing site runs on its own domain (e.g. www.example.com) while the
  // app keeps its current one. On that domain, / is the landing page and
  // nothing else in the app is reachable.
  const marketingHost = process.env.MARKETING_HOST;
  if (marketingHost && request.headers.get("host") === marketingHost) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/")) ||
    isPublicBrandAsset(pathname)
  ) {
    return NextResponse.next();
  }

  // Employee self-service lives under /me with its own cookie and sign-in; it
  // never touches (or accepts) the staff session.
  if (pathname === "/me" || pathname.startsWith("/me/")) {
    if (pathname === "/me/login") return NextResponse.next();
    const essToken = request.cookies.get(ESS_COOKIE)?.value;
    const ess = essToken ? await verifyEssToken(essToken) : null;
    if (!ess) return NextResponse.redirect(new URL("/me/login", request.url));
    return NextResponse.next();
  }

  // Supplier portal: same idea under /vendor, with its own cookie.
  if (pathname === "/vendor" || pathname.startsWith("/vendor/")) {
    if (pathname === "/vendor/login") return NextResponse.next();
    const vToken = request.cookies.get(VENDOR_COOKIE)?.value;
    const vendor = vToken ? await verifyVendorToken(vToken) : null;
    if (!vendor) return NextResponse.redirect(new URL("/vendor/login", request.url));
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
