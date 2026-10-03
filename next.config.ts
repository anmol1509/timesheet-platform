import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads (photos, passports, labour cards) travel inside server actions, which default to a 1 MB body.
  // The host rejects requests over about 4.5 MB before they reach the app, so this stays just under it.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Origins the dev server will serve scripts to. Listing 127.0.0.1 gives a cookie
  // jar separate from localhost (used to test staff and employee sign-in side by
  // side). Development only; has no effect in production builds.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
