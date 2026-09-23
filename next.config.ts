import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Origins the dev server will serve scripts to. Listing 127.0.0.1 gives a cookie
  // jar separate from localhost (used to test staff and employee sign-in side by
  // side). Development only; has no effect in production builds.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
