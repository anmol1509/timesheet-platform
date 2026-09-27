import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { POSTS } from "./blog/posts";
import { GUIDES } from "./guides/guides-data";
import { INDUSTRIES_DATA } from "./industries/industries-data";
import { SOLUTIONS_DATA } from "./solutions/solutions-data";

const MARKETING_HOST = "manpowersync.com";

// Standalone top-level pages with no per-item registry of their own.
const STATIC_PAGES = ["features", "solutions", "guides", "faq", "pricing", "industries"];
const STATIC_PAGE_PRIORITY: Record<string, number> = { features: 0.9, solutions: 0.8, pricing: 0.8 };

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
    ...SOLUTIONS_DATA.map((solution) => ({
      url: `https://${MARKETING_HOST}/${solution.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...STATIC_PAGES.map((page) => ({
      url: `https://${MARKETING_HOST}/${page}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: STATIC_PAGE_PRIORITY[page] ?? 0.7,
    })),
    ...INDUSTRIES_DATA.map((industry) => ({
      url: `https://${MARKETING_HOST}/industries/${industry.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
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
    ...GUIDES.map((guide) => ({
      url: `https://${MARKETING_HOST}/guides/${guide.slug}`,
      lastModified: new Date(guide.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
