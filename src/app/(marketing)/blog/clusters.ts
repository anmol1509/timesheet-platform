import { POSTS, type Post } from "./posts";

// Topic clusters for the blog. Each groups related posts around the product page
// ("pillar") that a reader on that topic is most likely to want next. The blog
// index, each post's "Related" block and the pillar pages' "Further reading"
// all read from here, so a new post only needs a `cluster` in posts.ts.
export type ClusterSlug = "payroll-wps" | "compliance" | "timesheets-billing" | "operations-buying";

export const CLUSTERS: readonly {
  slug: ClusterSlug;
  label: string;
  blurb: string;
  /** Product pages this cluster supports; the first is the main one. */
  pillars: readonly { href: string; label: string }[];
}[] = [
  {
    slug: "payroll-wps",
    label: "Payroll, WPS and labour law",
    blurb: "WPS salary files, gratuity and overtime: the rules, and where payroll goes wrong.",
    pillars: [{ href: "/wps-payroll-software-uae", label: "WPS payroll software" }],
  },
  {
    slug: "compliance",
    label: "Visas, IDs and compliance",
    blurb: "Keeping every visa, Emirates ID, labour card and permit valid across a large workforce.",
    pillars: [{ href: "/manpower-erp-uae", label: "Manpower ERP" }],
  },
  {
    slug: "timesheets-billing",
    label: "Timesheets, pricing and billing",
    blurb: "From the hours a worker logs to the rate you charge and the invoice the client pays.",
    pillars: [
      { href: "/timesheet-software-construction-uae", label: "Timesheet software" },
      { href: "/construction-invoicing-software-uae", label: "VAT invoicing software" },
    ],
  },
  {
    slug: "operations-buying",
    label: "Running operations and choosing software",
    blurb: "Camps, day-to-day operations and what to ask before you buy manpower software.",
    pillars: [
      { href: "/manpower-erp-uae", label: "Manpower ERP" },
      { href: "/camp-accommodation-management-software-uae", label: "Camp management software" },
    ],
  },
];

export const clusterOf = (slug: ClusterSlug) => CLUSTERS.find((c) => c.slug === slug)!;

const newestFirst = (a: Post, b: Post) => b.date.localeCompare(a.date);

export const postsInCluster = (slug: ClusterSlug) => POSTS.filter((p) => p.cluster === slug).sort(newestFirst);

/** Same-cluster posts first, topped up from the rest so there are always `n` to show. */
export function relatedPosts(post: Post, n = 3): Post[] {
  const others = POSTS.filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => p.cluster === post.cluster).sort(newestFirst);
  const rest = others.filter((p) => p.cluster !== post.cluster).sort(newestFirst);
  return [...same, ...rest].slice(0, n);
}

/** Posts that support a given product page, newest first. */
export function postsForPillar(href: string, n = 3): Post[] {
  const slugs = CLUSTERS.filter((c) => c.pillars.some((p) => p.href === href)).map((c) => c.slug);
  return POSTS.filter((p) => slugs.includes(p.cluster)).sort(newestFirst).slice(0, n);
}
