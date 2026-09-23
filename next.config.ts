import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server hydrate pages opened via 127.0.0.1, which gives a cookie
  // jar separate from localhost (used to test staff and employee sign-in side by
  // side). Development only; has no effect in production builds.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
