import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { POSTS } from "./blog/posts";

const MARKETING_HOST = "manpowersync.com";

// One entry per pillar landing page (root-level route) — add a slug here
// whenever a new one ships, instead of a repeated sitemap block.
const PILLAR_SLUGS = [
  "manpower-erp-uae",
  "wps-payroll-software-uae",
  "timesheet-software-construction-uae",
  "camp-accommodation-management-software-uae",
  "supplier-portal-software-uae",
];

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
    ...PILLAR_SLUGS.map((slug) => ({
      url: `https://${MARKETING_HOST}/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    {
      url: `https://${MARKETING_HOST}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...POSTS.map((post) => ({
      url: `https://${MARKETING_HOST}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
