import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads (photos, passports, labour cards) travel inside server actions, which default to a 1 MB body.
  // The host rejects requests over about 4.5 MB before they reach the app, so this stays just under it.
  // globalNotFound: the app has two root layouts (marketing and platform), so unmatched URLs
  // need a standalone 404 (src/app/global-not-found.tsx).
  experimental: { serverActions: { bodySizeLimit: "4mb" }, globalNotFound: true },
  // Origins the dev server will serve scripts to. Listing 127.0.0.1 gives a cookie
  // jar separate from localhost (used to test staff and employee sign-in side by
  // side). Development only; has no effect in production builds.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // The free timesheet template was linked as /tools/timesheet-template for a while; the page lives at the longer
  // address, so the old one is sent there permanently instead of returning a 404.
  // IndexNow wants its key file at the site root, <key>.txt; it is served by src/app/indexnow-key/route.ts.
  async rewrites() {
    return [{ source: "/:key([a-f0-9]{32}).txt", destination: "/indexnow-key" }];
  },
  // Versioned brand images never change under the same name, so browsers and the CDN can keep them for a year.
  async headers() {
    const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/brand-assets/wordmark-v1.png", headers: immutable },
      { source: "/brand-assets/mark-v1.png", headers: immutable },
    ];
  },
  async redirects() {
    return [{ source: "/tools/timesheet-template", destination: "/tools/construction-timesheet-template", permanent: true }];
  },
};

export default nextConfig;
