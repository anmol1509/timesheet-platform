import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const MARKETING_HOST = "manpowersync.com";

/**
 * The app domain (login.manpowersync.com) is a private, auth-gated system —
 * nothing there is meant to be publicly indexed. Only the marketing domain
 * gets an "Allow" robots policy and a sitemap reference.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host");
  if (host !== MARKETING_HOST) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login", "/me", "/vendor"],
    },
    sitemap: `https://${MARKETING_HOST}/sitemap.xml`,
  };
}
