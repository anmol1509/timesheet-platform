# ManpowerSync — Technical SEO, On-Page & Organic Traffic Audit

_Audit date: 13 Oct 2026 · Scope: the public marketing site served on `manpowersync.com` (Next.js 16.3.6 App Router, same codebase as the app at `login.manpowersync.com`)._

## How this audit was done

1. Read every marketing route, the shared layouts and chrome, `robots.ts`, `sitemap.ts`, `proxy.ts`, and the bundled Next 16 docs (`node_modules/next/dist/docs/`).
2. Ran a production build (`next build`) and served it with `next start`, using `MARKETING_HOST=manpowersync.com`.
3. Crawled all 34 URLs in the generated `sitemap.xml` with `Host: manpowersync.com`, then pulled title, description, canonical, robots, OG/Twitter tags, H1, JSON-LD, HTML weight, the JS chunks a page loads, and response headers.

Every number below comes from that crawl unless marked otherwise.

---

## 1. SEO Health Scorecard

| Area | Grade | Summary |
|---|---|---|
| Crawl directives (robots, noindex scoping) | **B+** | The noindex-by-default root plus per-page `index` opt-in is safe and works. `robots.txt` is correct on the apex host, but `www.` gets `Disallow: /`. |
| Sitemap | **B** | All 34 marketing URLs are listed. `lastModified` is "now" on every request for hubs and solution pages, so Google will learn to ignore it. |
| Canonicals | **A-** | Every page sets an absolute, self-referencing canonical. `/welcome` is still a 200 duplicate of `/` (the canonical covers it, but it should redirect). |
| Status codes and soft 404s | **D** | On the marketing host, any unknown URL **307s to the homepage** (soft 404). The real 404 page says "Back to dashboard". |
| Rendering and caching | **D** | Every marketing page is **dynamic** (`ƒ`) with `Cache-Control: private, no-store`, because the root layout reads `cookies()`. No CDN caching and no SSG, even with `generateStaticParams`. |
| Titles and meta descriptions | **C** | **30 of 34** titles end in "• Workforce ERP", which is the internal app name, not the brand. 21 of 34 are over 60 characters; 6 hub titles are a single word ("Blog", "Pricing"…). 13 descriptions are over 160 characters (`/pricing` is 295). |
| Headings | **B-** | Exactly one H1 per page and a sound H2/H3 tree. But solution-page and homepage H1s carry no keyword ("Every approved hour, billed."). |
| Open Graph / Twitter | **F** | **33 of 34** pages have no `og:image`, no `og:site_name` and only `twitter:card=summary`. The one page that has an image (`/`) points to `/brand-assets/logo-full.png`, which **307-redirects to `/`** on the marketing host. So no page has a working share image. |
| Structured data | **C** | Organization and SoftwareApplication JSON-LD exist only on `/`, and its logo URL is broken (same redirect). No `WebSite`, no `BreadcrumbList`. Article schema has no `image`, `dateModified` or publisher logo. 16 of 34 pages have no JSON-LD. FAQPage markup is duplicated across pages. |
| Internal linking | **C-** | The mega-menu links (9 solutions, 6 industries) **are not in the server HTML**: they render only after a hover or click. The homepage links to **zero** solution or industry pages. 5 of 8 blog posts have no in-body links. |
| Core Web Vitals (lab signals) | **D** | 32 of 34 pages ship the hero **H1 at `opacity:0`** until JS hydrates and animates (LCP delay). There is **~139 KB of base64 PNG** inlined in every page's HTML *and* in a client JS chunk. A blog post loads 1.06 MB of JS (388 KB gzipped). GTM uses `beforeInteractive` outside the root layout. |
| Content and programmatic scale | **B** | A strong base: 9 solution pages, 6 industry pages, 8 UAE-specific blog posts, typed registries (`SOLUTIONS_DATA`, `INDUSTRIES_DATA`, `POSTS`, `GUIDES`). The industry pages are near-duplicates of each other. |

### Strengths to keep

- **Two-host split done right.** The app host returns `Disallow: /` and an empty sitemap. The marketing host gets a scoped allow-list (`src/app/robots.ts`, `src/app/sitemap.ts`). The root `robots: { index: false }` default means a new app page can never leak into the index by accident.
- **Clean, keyword-rich URLs.** Examples: `/wps-payroll-software-uae`, `/industries/oil-gas-workforce-software-uae`, `/blog/eosb-gratuity-calculation-uae`.
- **Single-source registries** feed the nav, hubs and sitemap, so nothing drifts. This is the right foundation for programmatic SEO (§5).
- **Topical depth on UAE compliance:** WPS/SIF rejections, EOSB, overtime law, labour card vs visa. These are high-intent, low-competition queries.
- `<html lang="en">`, `locale: en_AE`, `next/font` with `display: swap` (the default), and no third-party font CSS.

### Primary blockers (fix these first)

1. **Every marketing page is uncached and dynamically rendered** (root layout `cookies()`).
2. **No working social or share image anywhere.** `/brand-assets/*` is redirected by `proxy.ts` on the marketing host.
3. **Soft 404s.** Unknown URLs 307 to `/`.
4. **Hero H1 hidden until hydration**, plus **139 KB of inline base64** on every page, which together hurt LCP.
5. **The wrong brand in 30 titles** ("• Workforce ERP").
6. **Money pages are not linked in crawlable HTML** from the homepage or the header.

---

## 2. High-Impact Quick Wins (each under an hour)

| # | Fix | File(s) | Effort | Impact |
|---|---|---|---|---|
| QW1 | Let static assets and metadata images through the marketing-host gate | `src/proxy.ts` | 10 min | Fixes `og:image`, the JSON-LD logo and `/brand/*` on the live site |
| QW2 | Return a real 404 instead of 307 → `/` for unknown URLs | `src/proxy.ts`, `src/app/not-found.tsx` | 20 min | Removes soft 404s and stops crawl budget leaking to `/` |
| QW3 | 308 `/welcome` → `/` on the marketing host | `src/proxy.ts` | 2 min | Removes the duplicate homepage |
| QW4 | Brand-correct title template ("%s \| ManpowerSync") for all marketing pages | new shared metadata, all marketing `page.tsx` | 30 min | CTR and brand consistency on 30 SERP listings |
| QW5 | Shared OG/Twitter defaults: `siteName`, a 1200×630 image, `summary_large_image` | `src/app/welcome/seo.ts` (new), every marketing `page.tsx` | 30 min | Rich previews on LinkedIn, WhatsApp and X, the main B2B share channels in the UAE |
| QW6 | Trim descriptions to ≤155 characters (`/pricing` is 295) | 13 pages listed in §2.6 | 20 min | Snippet control |
| QW7 | Rewrite the 6 one-word hub titles | `blog`, `guides`, `features`, `solutions`, `industries`, `pricing` `page.tsx` | 10 min | Rankable hub pages |
| QW8 | Render the hero H1 without `opacity:0` | `src/app/welcome/content-blocks.tsx` (`PageHero`), `welcome/page.tsx` (`AnimatedWords`) | 15 min | LCP on 32 pages |
| QW9 | Add solution and industry links to the homepage and footer | `src/app/welcome/content.ts` (`FOOTER`), `welcome/page.tsx` | 20 min | Internal PageRank to money pages |
| QW10 | Treat `www.manpowersync.com` as the marketing host (or 308 it to the apex) | `src/app/robots.ts`, `src/app/sitemap.ts`, Vercel domain settings | 10 min | Removes the `Disallow: /` risk if `www` is ever resolvable |

### 2.1 QW1–QW3: Marketing-host gate in `src/proxy.ts`

**Verified behaviour today** (`Host: manpowersync.com`):

```
/brand-assets/logo-full.png   307 -> /      ← og:image and JSON-LD logo
/brand/mark.svg               307 -> /
/opengraph-image              307 -> /      ← will break file-based OG images too
/does-not-exist               307 -> /      ← soft 404
/welcome                      200           ← duplicate of /
```

The marketing-host branch at `src/proxy.ts:50-56` returns before `isPublicBrandAsset()` is ever consulted, and the matcher at `:105` excludes only `icon.png`, `apple-icon.png`, `favicon.ico`, `robots.txt` and `sitemap.xml`.

```ts
// src/proxy.ts
const MARKETING_HOSTS = new Set(
  [process.env.MARKETING_HOST, process.env.MARKETING_HOST && `www.${process.env.MARKETING_HOST}`].filter(Boolean),
);

// Metadata image routes (opengraph-image / twitter-image, at any depth) and public brand files.
function isPublicAsset(pathname: string) {
  return (
    isPublicBrandAsset(pathname) ||
    /\/(opengraph|twitter)-image(-\w+)?(\.\w+)?$/.test(pathname)
  );
}

// Paths that belong to the app: send them to the app domain instead of the marketing homepage.
const APP_PATHS = ["/login", "/me", "/vendor"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  if (MARKETING_HOSTS.has(host)) {
    // One canonical host: www → apex, permanently.
    if (host.startsWith("www.")) {
      const url = request.nextUrl.clone();
      url.host = process.env.MARKETING_HOST!;
      return NextResponse.redirect(url, 308);
    }
    if (pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));
    if (pathname === "/welcome") return NextResponse.redirect(new URL("/", request.url), 308);
    if (isPublicAsset(pathname)) return NextResponse.next();
    if (MARKETING_CONTENT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next();
    }
    if (APP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) && process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.redirect(new URL(pathname, process.env.NEXT_PUBLIC_APP_URL), 308);
    }
    // Anything else: a real 404, not a redirect to the homepage.
    // Rewriting to a path no route matches renders app/not-found.tsx with status 404.
    return NextResponse.rewrite(new URL("/_marketing-404", request.url));
  }
  // …app-host logic unchanged…
}
```

Then make `src/app/not-found.tsx` host-aware. It currently says "Back to dashboard", which is wrong for a visitor on the marketing site. Swap the copy to "Back to home" and link to `/`, `/solutions` and `/blog`. Ideally, render the `SiteHeader`/`SiteFooter` chrome so a 404 still passes link equity.

> `www`: Vercel can do the www→apex redirect at the domain level (Project → Domains). If that is already configured, the `www` branch above is belt-and-braces. The real bug is that `robots.ts`/`sitemap.ts` compare `host !== "manpowersync.com"` exactly. **Verify in production** that `https://www.manpowersync.com/robots.txt` 308s rather than serving `Disallow: /`.

### 2.2 QW4–QW5: Shared marketing metadata

Today every marketing page writes its own `openGraph` object with no `images` or `siteName`. Next merges metadata **shallowly** (`generate-metadata.md` → "Merging"), so a page-level `openGraph` replaces any parent's. The title template comes from the root app layout (`"%s • Workforce ERP"`, `src/app/layout.tsx:28-31`).

Create one helper and use it everywhere:

```ts
// src/app/welcome/seo.ts
import type { Metadata } from "next";
import { SITE } from "./content";

export const SITE_URL = "https://manpowersync.com";
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE.name}: ${SITE.tagline}` };

/** Every marketing page's metadata goes through here, so title format, OG and
 * Twitter defaults, canonical and the index opt-in can never drift. */
export function marketingMetadata(opts: {
  path: string;            // "/blog/eosb-gratuity-calculation-uae"
  title: string;           // keyword-first, ≤ ~45 chars so the suffix fits in 60
  description: string;     // ≤ 155 chars
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  image?: string;          // per-page override, e.g. a generated OG image
  absoluteTitle?: boolean; // skip the "| ManpowerSync" suffix when the title is already long
}): Metadata {
  const url = `${SITE_URL}${opts.path === "/" ? "" : opts.path}`;
  const images = [opts.image ? { url: opts.image, width: 1200, height: 630 } : OG_IMAGE];
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : { absolute: `${opts.title} | ${SITE.name}` },
    description: opts.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    openGraph: {
      type: opts.type ?? "website",
      url,
      siteName: SITE.name,
      locale: "en_AE",
      title: opts.title,
      description: opts.description,
      images,
      ...(opts.type === "article" && {
        publishedTime: opts.publishedTime,
        modifiedTime: opts.modifiedTime ?? opts.publishedTime,
      }),
    },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, images: images.map((i) => i.url) },
  };
}
```

Usage (for example, `src/app/wps-payroll-software-uae/page.tsx`):

```ts
export const metadata = marketingMetadata({
  path: "/wps-payroll-software-uae",
  title: "WPS Payroll Software UAE",
  description: "Run UAE payroll from approved hours and export a bank-ready WPS SIF file — overtime, loans and gratuity applied automatically.",
});
```

And a branded default share image, generated at build time:

```tsx
// src/app/welcome/opengraph-image.tsx   (also add one at app root for "/", or for each section)
import { ImageResponse } from "next/og";
export const alt = "ManpowerSync — the operating system for manpower suppliers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
                    padding: 80, background: "#0b1530", color: "#fff", fontSize: 64, fontWeight: 700 }}>
        <div style={{ fontSize: 28, opacity: 0.7, marginBottom: 24 }}>ManpowerSync</div>
        Timesheets, WPS payroll & billing for UAE manpower suppliers
      </div>
    ),
    size,
  );
}
```

For blog posts and industry pages, add `opengraph-image.tsx` next to the page (or one per dynamic segment once posts move to `blog/[slug]`, §3.6) that renders `post.title`. That way every shared article gets its own card.

### 2.3 QW6–QW7: Titles and descriptions to change

Measured from the crawl, including the current suffix:

| URL | Current title (length) | Suggested title (before the " \| ManpowerSync" suffix) |
|---|---|---|
| `/blog` | Blog • Workforce ERP (20) | UAE Payroll, WPS & Labour Law Blog |
| `/guides` | Guides • Workforce ERP (22) | Manpower Software How-To Guides |
| `/pricing` | Pricing • Workforce ERP (23) | Pricing — Manpower ERP from AED 500/mo |
| `/features` | Features • Workforce ERP (24) | Manpower ERP Features: Timesheets to WPS |
| `/solutions` | Solutions • Workforce ERP (25) | Manpower Supply Software Solutions (UAE) |
| `/industries` | Industries • Workforce ERP (26) | Workforce Software by Industry (UAE) |
| `/camp-accommodation-management-software-uae` | … (83) | Labour Camp Management Software UAE |
| `/supplier-portal-software-uae` | … (83) | Subcontractor Portal Software UAE |
| `/timesheet-software-construction-uae` | … (79) | Construction Timesheet Software UAE |
| `/industries/facilities-management-…` | … (81) | FM Workforce Software UAE |
| `/blog/labour-card-work-permit-visa-difference-uae` | … (85) | Labour Card vs Work Permit vs Visa (UAE) |

Descriptions over 160 characters: `/pricing` (295), `/blog/wps-sif-rejection-reasons-uae` (195), `/blog/eosb-gratuity-calculation-uae` (190), `/timesheet-software-construction-uae` (181), `/ai-assistant-workforce-management` (178), `/blog/uae-overtime-rules-…` (175), `/blog/labour-card-…` (175), `/blog/visa-emirates-id-…` (173), `/supplier-portal-software-uae` (171), `/industries/facilities-management-…` (170), `/camp-accommodation-…` (169), `/industries/cleaning-hospitality-…` (169), `/` (165).

For blog posts, keep the long `description` in `posts.ts` as the on-page lead and add a separate `seoDescription` (≤155) for the meta tag. Three posts already do this with a separate `SEO_TITLE` (`how-to-price-…`, `construction-timesheet-format-…`, `manpower-supply-software-…`). Generalise that pattern into the registry.

### 2.4 QW8: Hero H1 rendered invisible

`PageHero` renders the H1 and lead through `<Reveal>` (`src/app/welcome/content-blocks.tsx:126-136`). Motion server-renders the `initial` state, so the HTML ships `style="opacity:0;transform:translateY(16px)"` on the H1 of **32 of 34 pages**. The homepage's `AnimatedWords` does the same per word, with blur. The LCP element therefore cannot paint until the 388 KB (gzipped) JS bundle downloads, parses, hydrates and runs a 0.5 s animation.

```tsx
// content-blocks.tsx — PageHero: paint the LCP text immediately; keep motion for below-the-fold content.
<h1 className={s.heroTitle} style={{ fontSize: "clamp(38px, 6vw, 62px)", letterSpacing: "-1.5px" }}>
  {title}
</h1>
{lead && <p className={s.heroSub}>{lead}</p>}
```

If the entrance effect must stay, use a CSS-only animation that starts **visible**, for example `@keyframes heroIn { from { transform: translateY(8px) } to { transform: none } }` with no opacity change. Never let above-the-fold text start at `opacity:0`. Apply the same change to `AnimatedWords` in `welcome/page.tsx:451-456`.

### 2.5 QW9: Crawlable links to money pages

From the crawled homepage HTML, the only internal links are `/blog`, `/faq`, `/features`, `/guides`, `/industries`, `/pricing`, `/solutions` and the three sign-in pages. **None of the 9 solution pages or the 6 industry pages are linked from `/`.** The header's Product/Solutions/Resources entries are `<button>`s (`site-chrome.tsx:154`), and their panels only mount when opened (`AnimatePresence` at `:181`). The mobile menu portals in after hydration (`mobile-menu.tsx:68`).

Two complementary fixes:

1. **Render the mega-menu panels in the server HTML and hide them with CSS.** Keep the panels mounted with `hidden`/`data-open` rather than conditionally rendering them. Or keep the animation but render a visually hidden `<ul>` of the same links inside `<nav>`, which is simpler.
2. **Extend the footer.** It is server-rendered on every page, so it is the cheapest sitewide link block:

```ts
// src/app/welcome/content.ts — FOOTER
import { SOLUTIONS_DATA } from "@/app/solutions/solutions-data";
import { INDUSTRIES_DATA } from "@/app/industries/industries-data";
{
  title: "Solutions",
  links: SOLUTIONS_DATA.map((s) => ({ label: s.label, href: `/${s.slug}` })),
},
{
  title: "Industries",
  links: INDUSTRIES_DATA.map((i) => ({ label: i.name, href: `/industries/${i.slug}` })),
},
```

Also add a "Solutions" `LinkCardGrid` section to the homepage, linking at least `/manpower-erp-uae`, `/wps-payroll-software-uae` and `/timesheet-software-construction-uae` with keyword anchor text.

---

## 3. Technical & Architectural Optimizations

### 3.1 Marketing pages are dynamic and uncached

- **Issue:** `src/app/layout.tsx:47` calls `cookies()` to pick the theme. That opts **every route under the root layout** into dynamic rendering. The build output marks every marketing route `ƒ (Dynamic)`, including `/industries/[slug]` despite its `generateStaticParams`. Responses carry `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, so each crawl and each visit runs a serverless function: slower TTFB, cold starts, and no edge cache. The marketing site doesn't use the theme cookie at all, since it has its own light design.
- **Fix:** Split into **two root layouts** with route groups. URLs don't change. The marketing layout has no request-time APIs, so its pages become static (SSG) and are served from Vercel's edge.
- **File paths:** `src/app/layout.tsx` → `src/app/(platform)/layout.tsx`; move `(app)`, `login`, `me`, `vendor` under `(platform)`; move `welcome`, `blog`, `guides`, `industries`, `solutions`, `features`, `faq`, `pricing` and the 9 solution folders under `src/app/(marketing)/`. `api/`, `robots.ts` and `sitemap.ts` stay at the root (route handlers don't need a layout).
- **Code:**

```
src/app/
├── (marketing)/
│   ├── layout.tsx            ← <html>/<body>, fonts, analytics, Organization+WebSite JSON-LD
│   ├── opengraph-image.tsx
│   ├── welcome/page.tsx      ← "/" via the proxy rewrite (the dashboard keeps "/" on the app host)
│   ├── blog/…  guides/…  industries/…  solutions/…  pricing/…  faq/…  features/…
│   └── wps-payroll-software-uae/… (and the other 8 solution pages)
├── (platform)/
│   ├── layout.tsx            ← today's root layout: cookies() theme, FormValidation, noindex default
│   ├── (app)/…  login/…  me/…  vendor/…
├── api/…  robots.ts  sitemap.ts
└── global-not-found.tsx      ← needed with multiple root layouts (experimental.globalNotFound)
```

```tsx
// src/app/(marketing)/layout.tsx
import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { MarketingAnalytics } from "./welcome/marketing-analytics";
import { SITE_URL } from "./welcome/seo";
import { JsonLd, organizationLd, websiteLd } from "@/lib/seo/jsonld";

const dmSans = DM_Sans({ weight: ["400", "500", "600"], variable: "--font-dm", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ weight: ["600", "700", "800"], variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ManpowerSync", template: "%s | ManpowerSync" },
  robots: { index: true, follow: true },
};

export const revalidate = 86400; // ISR: rebuild daily; content changes deploy anyway

export default function MarketingRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${dmSans.variable} ${jakarta.variable} antialiased`}>
      <body>
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <MarketingAnalytics />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
```

Notes:

- Today `welcome/layout.tsx` re-instantiates the same two fonts that the root layout already loads. That duplication disappears with this split.
- Moving to multiple root layouts means navigation *between* the groups does a full page load. That's fine here, because the marketing site and the app already live on different domains.
- Expected result after the change: the build output shows `○`/`●` for every marketing route, and the response header becomes `Cache-Control: s-maxage=…, stale-while-revalidate`.

**Lower-effort fallback**, if the split must wait: keep one root layout but stop reading `cookies()` there. Render `data-theme="light"` and apply a stored theme with a tiny inline `<script>` in the `(app)` layout's `<head>` (the classic no-flash pattern). That alone makes the marketing tree static.

### 3.2 About 139 KB of base64 images inline on every page

- **Issue:** `src/lib/brand-assets.ts` (139 KB) holds `BRAND_ICON` (33.5 KB) and `BRAND_LOGO` (105.6 KB) as `data:image/png;base64` strings. `site-chrome.tsx` is a `"use client"` module that imports them, so the strings ship **three times**:
  1. in the `<img src>` of the server HTML (header logo and footer icon on every page),
  2. in the RSC payload, and
  3. in a client JS chunk (crawl: `1hwin8xtxgspt.js`, 140 KB, which gzips poorly to 106 KB because base64 doesn't compress).

  `welcome/layout.tsx:42` also puts `BRAND_ICON` in `<link rel="icon">`, which is why the homepage carries 4 data URIs (294 KB of HTML). `public/brand-assets/logo-full.png` is a 1958×380 PNG weighing **1.1 MB**. It is the current `og:image`, far above what platforms like (under 300 KB recommended).
- **Fix:** Serve the brand as small static files. Export the wordmark as **SVG**, which is ideal at ~2–5 KB, or as a 2× WebP (~10 KB). Let the browser cache it once across pages. Delete `icons: { icon: BRAND_ICON }`, since `src/app/icon.png` and `apple-icon.png` already exist and are picked up by convention.
- **File paths:** `src/lib/brand-assets.ts`, `src/app/welcome/site-chrome.tsx`, `src/app/welcome/layout.tsx`, `src/components/BrandMark.tsx`, `src/app/login/auth-shell.tsx`, `public/brand-assets/*`. (`scripts/export-landing.mjs` uses the data URIs for the static export, so keep a build-time inliner there only.)
- **Code:**

```tsx
// site-chrome.tsx
import Image from "next/image";
import logo from "@/../public/brand-assets/logo-full.webp"; // static import → width/height known, hashed URL, immutable cache

export function Logo({ href }: { href: string }) {
  return (
    <a href={href} className={s.logo} aria-label={`${SITE.name} home`}>
      <Image src={logo} alt={SITE.name} height={44} style={{ width: "auto" }} priority />
    </a>
  );
}
```

> Static imports from `public/` are served through `/_next/static/media/...`, which `proxy.ts`'s matcher already excludes, so they also sidestep the marketing-host redirect bug in QW1.

### 3.3 Structured data: centralise, complete, deduplicate

**Issues found**

| Issue | Where |
|---|---|
| Organization and SoftwareApplication only on `/`; `logo` URL redirects (QW1) | `welcome/layout.tsx:66-89` |
| `SoftwareApplication.offers` has no `price`/`priceCurrency`, so it isn't eligible for software rich results. The real prices are public (AED 500/mo, AED 1,000/mo). | same |
| No `WebSite` entity; no `BreadcrumbList` anywhere | — |
| `Article` lacks `image`, `dateModified`, `mainEntityOfPage`, `url`, publisher `logo`; author is an Organization (weak E-E-A-T on YMYL-adjacent labour-law topics) | 8 × `blog/*/page.tsx` |
| Guides have no schema | 3 × `guides/*/page.tsx` |
| The same `FAQS` entries are marked up as `FAQPage` on `/faq` **and** on 6 solution pages (`FAQS.filter(...)`). The homepage also shows all 7 FAQs. Since Aug 2023 Google shows FAQ rich results only for authoritative government and health sites, so this markup earns nothing in SERPs and duplicates Q&A across URLs. | `faq`, `manpower-erp-uae`, `wps-payroll-…`, `timesheet-…`, `camp-…`, `supplier-portal-…`, `employee-self-service-…`, `ai-assistant-…`, `pricing` |
| `JSON.stringify` without escaping `<` (Next 16 docs recommend `.replace(/</g, "\\u003c")`) | all 20 JSON-LD sites |
| `openGraph.type: "article"` on solution and industry pages (they are product pages) | `industries/[slug]/page.tsx:24`, `manpower-erp-uae/page.tsx:24`, … |

**Fix:** one typed helper module, used everywhere.

```tsx
// src/lib/seo/jsonld.tsx
import { SITE } from "@/app/welcome/content";
const SITE_URL = "https://manpowersync.com";
const ORG_ID = `${SITE_URL}/#organization`;

type Thing = Record<string, unknown>;

export function JsonLd({ data }: { data: Thing | Thing[] }) {
  const graph = { "@context": "https://schema.org", "@graph": Array.isArray(data) ? data : [data] };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, "\\u003c") }}
    />
  );
}

export const organizationLd = (): Thing => ({
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE.name,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/brand-assets/logo-512.png`, width: 512, height: 512 },
  email: SITE.salesEmail,
  areaServed: [{ "@type": "Country", name: "United Arab Emirates" }, "GCC"],
  sameAs: [/* LinkedIn company page, YouTube, Crunchbase… add as they exist */],
});

export const websiteLd = (): Thing => ({
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  url: SITE_URL,
  name: SITE.name,
  publisher: { "@id": ORG_ID },
  inLanguage: "en-AE",
});

export const softwareLd = (): Thing => ({
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: SITE.name,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Workforce management / Manpower ERP",
  operatingSystem: "Web browser",
  url: SITE_URL,
  publisher: { "@id": ORG_ID },
  offers: [
    { "@type": "Offer", name: "Basic", price: "500", priceCurrency: "AED",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "500", priceCurrency: "AED", billingDuration: "P1M" } },
    { "@type": "Offer", name: "Pro", price: "1000", priceCurrency: "AED",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "1000", priceCurrency: "AED", billingDuration: "P1M" } },
  ],
  // Add aggregateRating only when backed by real, on-page, verifiable reviews (e.g. imported from G2/Capterra).
});

export const breadcrumbLd = (items: { name: string; path: string }[]): Thing => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_URL}${it.path}`,
  })),
});

export const articleLd = (p: {
  path: string; title: string; description: string; datePublished: string; dateModified?: string;
  image?: string; authorName?: string; authorUrl?: string;
}): Thing => ({
  "@type": "BlogPosting",
  "@id": `${SITE_URL}${p.path}#article`,
  mainEntityOfPage: `${SITE_URL}${p.path}`,
  url: `${SITE_URL}${p.path}`,
  headline: p.title,
  description: p.description,
  image: p.image ?? `${SITE_URL}${p.path}/opengraph-image`,
  datePublished: p.datePublished,
  dateModified: p.dateModified ?? p.datePublished,
  inLanguage: "en-AE",
  author: p.authorName
    ? { "@type": "Person", name: p.authorName, url: p.authorUrl }
    : { "@id": ORG_ID },
  publisher: { "@id": ORG_ID },
});
```

Then:

- **Marketing root layout:** `organizationLd()` and `websiteLd()` on every page.
- **`/`, `/pricing`, `/manpower-erp-uae`:** `softwareLd()`.
- **Every non-home page:** `breadcrumbLd(...)`, plus a visible breadcrumb (§3.5).
- **Blog posts:** `articleLd(...)` from the `POSTS` registry. Add `updated` and `author` fields to `posts.ts`.
- **Guides:** `articleLd` (type `TechArticle`). `HowTo` rich results were retired in 2023, so don't spend effort there.
- **FAQPage:** keep it only on `/faq` (and on blog posts whose FAQ is unique to them). Remove the duplicated `FAQS.filter(...)` FAQPage blocks from the 6 solution pages. Better still, give each solution page its **own** 3–5 page-specific questions, such as "Which banks accept the SIF file?" on the WPS page. That's unique content that can win People-Also-Ask regardless of rich-result eligibility.

### 3.4 Sitemap accuracy

- **Issue:** `src/app/sitemap.ts:25` sets `lastModified: now` for the homepage, solutions, static pages and industries. Every fetch reports every page as changed today, so Google learns to ignore the site's `lastmod`, which also hides genuine blog updates. Blog and guide entries use the publish date only, never an update date. `changeFrequency` and `priority` are ignored by Google; they're harmless but not worth tuning.
- **Fix:** Put `updated` dates in the registries and emit real dates. Use one source of truth for the host (`process.env.MARKETING_HOST`), and accept `www`.
- **File paths:** `src/app/sitemap.ts`, `src/app/robots.ts`, `blog/posts.ts`, `guides/guides-data.ts`, `solutions/solutions-data.ts`, `industries/industries-data.ts`.

```ts
// src/app/sitemap.ts
const MARKETING_HOST = process.env.MARKETING_HOST ?? "manpowersync.com";
const isMarketing = (h: string | null) => h === MARKETING_HOST || h === `www.${MARKETING_HOST}`;
const SITE_DEPLOYED_AT = new Date(process.env.VERCEL_GIT_COMMIT_DATE ?? "2026-10-09"); // or a constant bumped on content edits

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isMarketing((await headers()).get("host"))) return [];
  const u = (p: string) => `https://${MARKETING_HOST}${p}`;
  return [
    { url: u("/"), lastModified: SITE_DEPLOYED_AT },
    ...SOLUTIONS_DATA.map((s) => ({ url: u(`/${s.slug}`), lastModified: new Date(s.updated) })),
    ...POSTS.map((p) => ({ url: u(`/blog/${p.slug}`), lastModified: new Date(p.updated ?? p.date) })),
    // …
  ];
}
```

When the blog passes ~50 posts, or programmatic pages land (§5), split with `generateSitemaps` (one sitemap for blog, one per programmatic family). That way Search Console reports indexing per section.

### 3.5 Breadcrumbs and hub architecture

- **Issue:** There are no breadcrumbs (UI or schema). The URL tree is flat: the 9 solution pages sit at the root (`/wps-payroll-software-uae`), not under `/solutions/…`. That's fine for keywords, but the hierarchy is then invisible to users and crawlers. Articles only link "← Back to the blog".
- **Fix:** Add a `Breadcrumbs` server component inside `PageHero` (above the eyebrow) and emit `breadcrumbLd` with the same items. Keep the flat URLs; **don't move them**, because they're already the canonical URLs and moving them would cost a redirect hop and some equity. Express the hierarchy logically: Home › Solutions › WPS Payroll Software.
- **File paths:** `src/app/welcome/content-blocks.tsx` (`PageHero` gets a `crumbs` prop), every marketing `page.tsx`.

```tsx
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={s.crumbs}>
        <ol>
          {items.map((it, i) => (
            <li key={it.path}>
              {i < items.length - 1 ? <a href={it.path}>{it.name}</a> : <span aria-current="page">{it.name}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(items)} />
    </>
  );
}
```

### 3.6 Blog: from hand-written pages to a content registry

- **Issue:** Each post is a hand-written `page.tsx` that re-declares metadata and JSON-LD (8 copies of the same boilerplate, already drifting: 3 have `publisher`, 5 don't; 3 use `SEO_TITLE`). Posts have no related-post block and no author, and 5 of 8 contain **zero** in-body internal links:
  - `eosb-gratuity-calculation-uae`
  - `labour-card-work-permit-visa-difference-uae`
  - `uae-overtime-rules-construction-workers`
  - `visa-emirates-id-expiry-compliance-checklist`
  - `wps-sif-rejection-reasons-uae`
- **Fix:** Move to `blog/[slug]/page.tsx` plus MDX (`@next/mdx`, see `node_modules/next/dist/docs/01-app/02-guides/mdx.md`) or TSX content modules. Have `generateStaticParams`, `generateMetadata` and the JSON-LD all read from `posts.ts`, so a new post is one MDX file plus one registry line. Add a `RelatedPosts` component (same `topic` tag, three posts) and a contextual CTA to the matching solution page.
- **Immediate content fix:** add 2–4 contextual links in each of those 5 posts. For example:
  - WPS SIF rejections → `/wps-payroll-software-uae` and `/guides/run-payroll-export-wps-file`
  - EOSB → `/wps-payroll-software-uae`
  - Overtime → `/timesheet-software-construction-uae`
  - Visa, labour card and expiry posts → `/manpower-erp-uae` and each other

```tsx
// src/app/(marketing)/blog/[slug]/page.tsx
export const dynamicParams = false;
export function generateStaticParams() { return POSTS.map((p) => ({ slug: p.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = POSTS.find((p) => p.slug === (await params).slug)!;
  return marketingMetadata({
    path: `/blog/${post.slug}`, title: post.seoTitle ?? post.title, description: post.seoDescription ?? post.description,
    type: "article", publishedTime: post.date, modifiedTime: post.updated,
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = POSTS.find((p) => p.slug === (await params).slug)!;
  const { default: Body } = await import(`../_posts/${post.slug}.mdx`);
  return (
    <ContentShell>
      <JsonLd data={[articleLd({ path: `/blog/${post.slug}`, title: post.title, description: post.description,
                                 datePublished: post.date, dateModified: post.updated, authorName: post.author })]} />
      <PostLayout post={post}><Body /></PostLayout>
      <RelatedPosts current={post} />
    </ContentShell>
  );
}
```

### 3.7 Heading and keyword alignment

- **Issue:** H1s on the solution pages are brand copy with no query terms. The title and H1 should reinforce each other.

| Page | Current H1 | Suggested H1 (keep the slogan as the lead) |
|---|---|---|
| `/manpower-erp-uae` | Your whole manpower business, in one system. | Manpower ERP for UAE labour supply companies |
| `/wps-payroll-software-uae` | From approved hours to a bank-ready WPS file. | WPS payroll software for UAE manpower suppliers |
| `/timesheet-software-construction-uae` | Enter hours once. Everything else follows. | Construction timesheet software for the UAE |
| `/construction-invoicing-software-uae` | Every approved hour, billed. | VAT invoicing software for manpower supply |
| `/camp-accommodation-management-software-uae` | Know who sleeps where and who rides which bus. | Labour camp & accommodation management software |
| `/pricing` | Choose your right plan | Manpower ERP pricing (AED, per month) |
| `/` | Your workforce, from timesheet to payday. | Keep it, but add a visible keyword sub-H1/eyebrow: "Manpower ERP & WPS payroll software for UAE suppliers" |

- **Also:** `LinkCardGrid` emits a "Read more" anchor on every card (`content-blocks.tsx:423`), producing dozens of identical, non-descriptive anchors. Either drop the second link (the H3 already links) or give it `aria-hidden` and `tabIndex={-1}`. The card title is already the right anchor text.
- **Alt text:** no `<img>` is missing `alt` (the decorative footer icon correctly uses `alt=""`). No action needed.

### 3.8 Industry pages are near-duplicates

- **Issue:** `industries/[slug]/page.tsx` renders the **same** two `visuals` blocks, the same three `related` cards and the same CTA lead for all six industries. Only the hero, the intro and the three differentiators vary, roughly 150 unique words per page. With six pages templated this thinly, Google tends to cluster them and index just one.
- **Fix:** Move the visuals, related links, FAQs and stats into `INDUSTRIES_DATA`. Target ≥600 unique words per page. Ideas:
  - Industry-specific compliance: CICPA passes for oil & gas, SIRA licences for security, the DM health card for cleaning.
  - Typical trades and rates.
  - A worked example ("a 400-worker MEP subcontractor…").
  - A per-industry FAQ.
  - Links to the 2–3 most relevant solution pages and blog posts.

### 3.9 Third-party scripts

- **Issue:** GTM loads with `strategy="beforeInteractive"` from `MarketingAnalytics`, which renders inside `ContentShell` and the welcome layout, not the root layout. The Next 16 docs say `beforeInteractive` "must be placed inside a root layout". The marketing pages also don't need GTM ahead of first-party code. Clarity uses `afterInteractive`.
- **Fix:** Use `afterInteractive` for GTM, or `@next/third-parties/google`'s `<GoogleTagManager gtmId="GTM-TR7NVRT2" />`. Use `lazyOnload` for Clarity, since session replay doesn't need to compete with hydration. Once §3.1 lands, render `MarketingAnalytics` once in `(marketing)/layout.tsx` and remove it from `ContentShell`.
- **File paths:** `src/app/welcome/marketing-analytics.tsx`, `src/app/welcome/content-shell.tsx`, `src/app/welcome/layout.tsx`.

### 3.10 Internationalisation (strategic)

The site already declares `locale: "en_AE"`. A large share of UAE decision-makers search in Arabic, and Arabic competition for terms like "برنامج إدارة العمالة" (manpower management software) and "نظام حماية الأجور" (WPS) is thin. When ready:

- Add `/ar/...` routes with `dir="rtl"`.
- Add `alternates.languages: { "en-AE": url, "ar-AE": arUrl, "x-default": url }` in `marketingMetadata`.
- Add `alternates` entries to the sitemap.

Start with the homepage, `/manpower-erp-uae`, `/wps-payroll-software-uae` and `/pricing`.

---

## 4. Core Web Vitals & Speed Strategy

Lab measurements from the local production build (blog post page):

| Signal | Today | Target |
|---|---|---|
| Rendering | Dynamic SSR per request, `no-store` | Static/ISR at the edge (§3.1) |
| HTML weight | ~175–190 KB per page (294 KB on `/`) | < 60 KB |
| Inline base64 images | 2 per page (4 on `/`), ~139 KB | 0 (§3.2) |
| JS loaded | 1.06 MB raw / **388 KB gzipped** | < 200 KB gzipped |
| LCP element | H1 with `opacity:0` until hydration and animation | Painted from the first HTML byte (QW8) |
| `og:image` | 1.1 MB PNG (and redirected) | ≤ 200 KB, 1200×630 |

### 4.1 LCP

1. **Make the pages static (§3.1).** This has the biggest TTFB win: edge-served HTML instead of a cold serverless function.
2. **Don't hide hero text (QW8).** LCP can't happen while the H1 is at `opacity:0`.
3. **Remove the base64 logo (§3.2).** It shrinks the HTML that must download before the hero renders, and drops 106 KB gzipped from the JS critical path.
4. **Fonts:** the marketing pages load DM Sans (3 weights), Plus Jakarta Sans (5 weights) and, through the root layout, Geist Mono (unused on marketing). After §3.1, load only what marketing uses. Audit whether Jakarta 400/500 are needed (headings typically use 600–800). `next/font` self-hosts and preloads, so every dropped weight is one fewer preload.

### 4.2 INP and total JS

1. **Too much is client-side.** `welcome/page.tsx` (724 lines), `content-blocks.tsx`, `solution-page.tsx` and `site-chrome.tsx` are all `"use client"`. Every static paragraph, card and FAQ gets hydrated. Split them up:
   - Server: `Section`, `PointGrid`, `TintCardGrid`, `ChipRow`, `StatsRow`, `LinkCardGrid`, `FaqList` (`<details>` needs no JS), `CtaBand`, `PageHero`, `SiteFooter`.
   - Client islands: only `BookDemoButton`, `MagneticButton`, `NavLinks`, `MobileMenu`, `Reveal` wrappers and `ProductVisual` animations.

   Pass server-rendered children *into* client wrappers (`<Reveal>{serverContent}</Reveal>`). Expect a large reduction in the per-page chunk.
2. **Motion feature bundle.** `MotionProvider` imports `domMax` synchronously (`LazyMotion features={domMax}`). Its comment says "lazy-loaded … costs nothing on first paint", which isn't true when the features object is imported statically. Load features on demand:

   ```tsx
   const loadFeatures = () => import("motion/react").then((m) => m.domMax);
   <LazyMotion features={loadFeatures} strict>…</LazyMotion>
   ```

   Also consider `domAnimation` (smaller) on the marketing site if `layoutId` (the nav hover pill) can become a CSS transition.
3. **Defer non-critical widgets.** `BookDemoButton` portals a dialog. Load the dialog body with `next/dynamic(() => import("./DemoDialog"), { ssr: false })` on first click or hover. Set Clarity to `lazyOnload` (§3.9).
4. **Root-layout client code.** `FormValidation` (from the app root layout) is irrelevant to marketing pages and disappears from them after §3.1.

### 4.3 CLS

- Header logo `<img>` elements have `width`/`height` attributes, but the inline style `height:auto; width:auto` cancels the reserved box until the image decodes. With `next/image` and a static import (§3.2), dimensions are reserved correctly.
- `Reveal` animates `transform` and `opacity` only, which is CLS-safe. Keep it that way: never animate `height` or margins on in-flow content.
- The `<Decorations>` SVGs in the hero are absolutely positioned. That's fine.

### 4.4 Images and caching

- Re-export `logo-full.png` (1.1 MB), `logo.png` (1.1 MB) and `icon.png` (287 KB) as SVG, or as WebP/AVIF at 2× display size. Use `next/image` for anything raster, because it serves AVIF/WebP from `/_next/image` with long-lived caching.
- The login hero is already on Cloudinary with `f_auto/q_auto`. Use the same pattern for any future screenshots on marketing pages.
- Product screenshots are a strong conversion and SEO asset (image search, "manpower software screenshot"). Today `ProductVisual` draws them as animated JSX. Consider adding real, compressed screenshots with descriptive `alt`, lazy-loaded below the fold.
- After §3.1, static HTML is cached at the edge automatically. For ISR pages, `export const revalidate = 86400` in the marketing layout is enough. Use `revalidatePath` from a CMS webhook later if content moves out of the repo.

### 4.5 Measure

- Add `@vercel/speed-insights` (field CWV per route) to the marketing layout only.
- Track the CrUX origin report for `manpowersync.com` in Search Console → Core Web Vitals.
- Add a Lighthouse CI step on PRs that touch `src/app/(marketing)/**`, with budgets: LCP < 2.5 s, TBT < 200 ms, JS < 200 KB gzipped.

---

## 5. Programmatic SEO & Content Hub Suggestions

The repo already has the right primitive: typed registries (`SOLUTIONS_DATA`, `INDUSTRIES_DATA`, `POSTS`, `GUIDES`) feeding a shared template (`SolutionPage`), the nav and the sitemap. Every family below follows the same recipe:

> registry entry in `*-data.ts` → `[slug]/page.tsx` with `generateStaticParams` + `dynamicParams = false` → `marketingMetadata()` + `breadcrumbLd()` + `opengraph-image.tsx` → sitemap section → links from the hub and the relevant solution pages.

Remember to add each new top-level path to `MARKETING_CONTENT_PATHS` in `src/proxy.ts`, or it will be blocked on the marketing host. Better still, derive that list from the registries.

### 5.1 Free calculators (highest ROI, uses existing code)

`src/lib/gratuity.ts` (`gratuity()`, `yearsOfService()`, with tests) and `src/lib/payroll.ts` are pure functions with no server imports, so they can run client-side as-is. UAE calculator queries have high volume and earn links naturally:

| URL | Powered by | Target queries |
|---|---|---|
| `/tools/gratuity-calculator-uae` | `src/lib/gratuity.ts` | "gratuity calculator uae", "eosb calculator" |
| `/tools/overtime-calculator-uae` | overtime rules in `src/lib/payroll.ts` / pay rules | "overtime calculation uae labour law" |
| `/tools/manpower-hourly-rate-calculator` | the formula already written up in `/blog/how-to-price-manpower-supply-uae-hourly-rate` | "manpower rate calculation", "labour supply rate per hour uae" |
| `/tools/wps-sif-file-checker` | `src/lib/wps.ts` (`buildSif`) validation logic | "sif file format", "wps file rejected" |

Each tool page should have a server-rendered explainer (H1, formula, worked example, FAQ), a client-side calculator island, `SoftwareApplication` or `WebApplication` JSON-LD (`applicationCategory: "FinanceApplication"`, `offers.price: 0`), and a CTA to the matching solution page. Link the tools from the related blog posts, which already rank for the informational side of these queries.

### 5.2 Comparison and alternative pages

`/compare/[slug]` (registry `COMPARISONS`). Example slugs:

- `manpowersync-vs-excel`
- `manpowersync-vs-generic-hrms`
- `manpower-erp-vs-hrms`
- Named competitors, such as `…-vs-<competitor>`, with fair, factual feature tables (the `pricing-plans.tsx` table component can be reused)

These capture high-intent "X alternative" and "X vs Y" queries. Add a `/compare` hub.

### 5.3 Integrations and WPS directory

`/integrations/[slug]` from an `INTEGRATIONS` registry. The WPS angle is unique: one page per **bank or exchange house that accepts the SIF**, for example "WPS payroll with Emirates NBD", "… with Al Ansari Exchange". Cover the file requirements, common rejection causes (cross-link the SIF blog post) and how the export works. Also add pages for the Excel/CSV import, the public REST API (`src/app/api/v1/[...path]`, which already exists), webhooks and accounting exports (`api/finance/export`, `api/payroll/[id]/journal`).

### 5.4 Industry × emirate matrix, with care

`/industries/[slug]` already exists. Add an `EMIRATES` registry (Dubai, Abu Dhabi, Sharjah, …) **only where content genuinely differs** by emirate: for example Abu Dhabi's ADNOC/CICPA passes for oil & gas, or Dubai Municipality requirements for cleaning. Ship a page only if it has ≥400 unique words and a distinct FAQ. Otherwise it's a doorway page and will be filtered. Start with 3–5 high-value combinations, not the full 6 × 7 grid.

### 5.5 Trade and role glossary

`src/lib/payrollGlossary.ts` and the `trades` lookups show you already model the domain vocabulary. Build:

- `/glossary/[term]`: WPS, SIF, MOHRE, labour card, EOSB, MOL establishment ID, rest-day pay. Each term gets 150–300 words, `DefinedTerm` JSON-LD, and links to the blog post and solution page.
- `/trades/[trade]`: mason, steel fixer, electrician, scaffolder. Each covers typical UAE wage bands, required documents and how to deploy and bill that trade. These pages capture long-tail queries from both suppliers and their clients.

### 5.6 Content hub structure (topic clusters)

Organise the blog into clusters, each with a pillar page that is the matching solution page:

| Pillar (money page) | Cluster posts (existing ✔ / to write ✚) |
|---|---|
| `/wps-payroll-software-uae` | ✔ WPS SIF rejections · ✔ EOSB gratuity · ✔ Overtime rules · ✚ WPS deadlines & penalties · ✚ Payroll for unlimited vs limited contracts · ✚ Salary deductions allowed under UAE law |
| `/manpower-erp-uae` | ✔ Buyer's checklist · ✔ Pricing manpower supply · ✚ Manpower ERP vs HRMS · ✚ Starting a manpower supply company in the UAE (licensing) |
| `/timesheet-software-construction-uae` | ✔ Timesheet format · ✚ Client timesheet disputes · ✚ Rest-day & public holiday hours |
| `/manpower-erp-uae` → compliance | ✔ Visa / Emirates ID expiry checklist · ✔ Labour card vs work permit · ✚ MOHRE fines table · ✚ Medical fitness & ID renewal timelines |
| `/camp-accommodation-management-software-uae` | ✚ Labour accommodation standards UAE · ✚ Camp occupancy planning |

Implement the clusters in code by adding `cluster: "wps" | "compliance" | …` to `POSTS`. Then:

- Each solution page auto-renders "Further reading" from its cluster.
- Each post auto-renders "Related" from its cluster, plus a CTA to its pillar.
- `/blog` groups posts by cluster with H2s instead of one flat list.

This creates the dense, bidirectional links that are currently missing (§2.5 and §3.6).

### 5.7 E-E-A-T and lead-gen plumbing

- **Authors:** add `/about` and author pages (`/authors/[slug]`) with real names and payroll/HR credentials. Use `Person` JSON-LD on posts. Labour-law content sits close to YMYL, so named expertise matters.
- **Proof:** case studies (`/customers/[slug]`) with metrics ("SIF rejections went from 6/month to 0"), plus logos with `alt` text. Add `Review`/`aggregateRating` markup only when it reflects real, on-page reviews.
- **Contact:** a `/contact` page with an address and phone number (and `LocalBusiness`/`PostalAddress` on the Organization once there's a registered UAE address). Today the only contact paths are mailto links and the demo dialog. A crawlable contact page is a trust signal and gives branded queries a landing page.
- **Conversion tracking:** fire a GTM `dataLayer` event on demo submission from `BookDemoButton` (the `DemoRequest` model already stores leads). Organic sessions can then be attributed to pipeline in GA4 or Search Console.

---

## Appendix A — Implementation order

| Sprint | Items |
|---|---|
| **Week 1** | QW1–QW10 · §3.2 base64 removal · §3.3 JSON-LD helper (Organization, WebSite, Software, Breadcrumb, BlogPosting) · §3.4 sitemap dates |
| **Week 2** | §3.1 root-layout split → static marketing · §4.2 server/client split of `content-blocks` · §3.9 scripts |
| **Weeks 3–4** | §3.6 blog → registry + MDX, related posts, internal links · §3.7 H1s · §3.8 industry content · Search Console + Speed Insights baselines |
| **Month 2+** | §5.1 calculators · §5.2 comparisons · §5.3 integrations · §5.6 clusters · §3.10 Arabic |

## Appendix B — Verification checklist after each deploy

```bash
curl -sI https://manpowersync.com/brand-assets/logo-full.png | head -1     # expect 200 (today: 307)
curl -sI https://manpowersync.com/this-does-not-exist | head -1           # expect 404 (today: 307)
curl -sI https://manpowersync.com/welcome | head -1                       # expect 308 → /
curl -s  https://www.manpowersync.com/robots.txt                          # expect 308 or the Allow policy, never "Disallow: /"
curl -sI https://manpowersync.com/wps-payroll-software-uae | grep -i cache-control   # expect s-maxage, not no-store
curl -s  https://manpowersync.com/blog | grep -o '<title>[^<]*'           # expect "… | ManpowerSync"
curl -s  https://manpowersync.com/blog | grep -c 'data:image/png;base64'  # expect 0
curl -s  https://manpowersync.com/ | grep -o 'href="/wps-payroll-software-uae"' | head -1   # expect a match
```

Then validate a sample of pages in Google's [Rich Results Test](https://search.google.com/test/rich-results), check OG previews with LinkedIn's Post Inspector, and resubmit `sitemap.xml` in Search Console.
