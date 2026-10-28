import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { POSTS } from "./(marketing)/blog/posts";
import { GUIDES } from "./(marketing)/guides/guides-data";
import { INDUSTRIES_DATA } from "./(marketing)/industries/industries-data";
import { SOLUTIONS_DATA } from "./(marketing)/solutions/solutions-data";
import { TOOLS } from "./(marketing)/tools/tools-data";
import { COMPARISONS } from "./(marketing)/compare/compare-data";
import { SITE_HOST, isMarketingHost } from "@/lib/seo/site";

const MARKETING_HOST = SITE_HOST;

// Bump when the landing/solution/industry copy changes. A real date (not "now")
// is what lets Google trust <lastmod> and recrawl only what actually changed.
const SITE_CONTENT_UPDATED = new Date("2026-10-14");

// Standalone top-level pages with no per-item registry of their own.
const STATIC_PAGES = ["features", "solutions", "guides", "faq", "pricing", "industries", "tools", "compare"];
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
  if (!isMarketingHost(host)) return [];

  const now = SITE_CONTENT_UPDATED;
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
      lastModified: new Date(post.updated ?? post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      // The Arabic version of the gratuity calculator; the English page lists it as its hreflang alternate.
      url: `https://${MARKETING_HOST}/ar/tools/gratuity-calculator-uae`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    ...TOOLS.map((tool) => ({
      url: `https://${MARKETING_HOST}/tools/${tool.slug}`,
      lastModified: new Date(tool.updated),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...COMPARISONS.map((c) => ({
      url: `https://${MARKETING_HOST}/compare/${c.slug}`,
      lastModified: new Date(c.updated),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...GUIDES.map((guide) => ({
      url: `https://${MARKETING_HOST}/guides/${guide.slug}`,
      lastModified: new Date(guide.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
