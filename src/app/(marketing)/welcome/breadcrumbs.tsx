"use client";

import { usePathname } from "next/navigation";
import { JsonLd } from "@/lib/seo/jsonld";
import { SITE_URL } from "@/lib/seo/site";
import { POSTS } from "@/app/(marketing)/blog/posts";
import { GUIDES } from "@/app/(marketing)/guides/guides-data";
import { INDUSTRIES_DATA } from "@/app/(marketing)/industries/industries-data";
import { SOLUTIONS_DATA } from "@/app/(marketing)/solutions/solutions-data";
import { TOOLS } from "@/app/(marketing)/tools/tools-data";
import { COMPARISONS } from "@/app/(marketing)/compare/compare-data";
import s from "./welcome.module.css";

type Crumb = { name: string; path: string };

const HUBS: Record<string, string> = {
  blog: "Blog",
  guides: "Guides",
  industries: "Industries",
  solutions: "Solutions",
  features: "Features",
  faq: "FAQ",
  pricing: "Pricing",
  tools: "Free tools",
  compare: "Compare",
};

// Children of a hub live at /<hub>/<slug>; the nine product pages sit at the
// root but belong, logically, under Solutions.
const CHILDREN: Record<string, { slug: string; name: string }[]> = {
  blog: POSTS.map((p) => ({ slug: p.slug, name: p.title })),
  guides: GUIDES.map((g) => ({ slug: g.slug, name: g.title })),
  industries: INDUSTRIES_DATA.map((i) => ({ slug: i.slug, name: i.name })),
  tools: TOOLS.map((t) => ({ slug: t.slug, name: t.label })),
  compare: COMPARISONS.map((c) => ({ slug: c.slug, name: c.label })),
};

/** Home › hub › page, worked out from the URL and the same registries that build the pages. */
export function crumbsFor(pathname: string): Crumb[] | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  if (!first) return null;
  const home = { name: "Home", path: "/" };
  if (second === undefined) {
    const solution = SOLUTIONS_DATA.find((x) => x.slug === first);
    if (solution) return [home, { name: "Solutions", path: "/solutions" }, { name: solution.label, path: `/${first}` }];
    return HUBS[first] ? [home, { name: HUBS[first], path: `/${first}` }] : null;
  }
  const child = CHILDREN[first]?.find((c) => c.slug === second);
  return child
    ? [home, { name: HUBS[first], path: `/${first}` }, { name: child.name, path: `/${first}/${second}` }]
    : null;
}

export function Breadcrumbs() {
  const crumbs = crumbsFor(usePathname() ?? "/");
  if (!crumbs) return null;
  return (
    <>
      <nav aria-label="Breadcrumb" className={s.crumbs}>
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.path}>
              {i < crumbs.length - 1 ? <a href={c.path}>{c.name}</a> : <span aria-current="page">{c.name}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.name,
            item: `${SITE_URL}${c.path === "/" ? "" : c.path}`,
          })),
        }}
      />
    </>
  );
}
