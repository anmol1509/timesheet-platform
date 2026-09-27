import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const MARKETING_HOST = "manpowersync.com";

/**
 * Only the marketing domain has anything worth listing — the app domain
 * (login.manpowersync.com) is private and auth-gated. "/welcome" itself is
 * left out: it's the same page as "/" (the marketing host rewrites "/" to
 * it), and listing both would be duplicate-content noise; the canonical tag
 * on that page points back to "/" either way.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host");
  if (host !== MARKETING_HOST) return [];

  const now = new Date();
  return [
    {
      url: `https://${MARKETING_HOST}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
