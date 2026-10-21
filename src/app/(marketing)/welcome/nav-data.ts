import { INDUSTRIES_DATA } from "@/app/(marketing)/industries/industries-data";
import { SOLUTIONS_DATA } from "@/app/(marketing)/solutions/solutions-data";
import { POSTS } from "@/app/(marketing)/blog/posts";
import type { IconName } from "./content-blocks";

export type MenuItem = { label: string; href: string; description?: string; icon?: IconName; /** A small badge such as "New". */ tag?: string };
export type MenuColumn = { title: string; items: MenuItem[]; /** Sit the column on a soft tinted background. */ tint?: boolean };

/** A call-out card at the end of a panel: a real screen, a line and the demo button. */
export type MenuFeatured = { image: { src: string; width: number; height: number; alt: string }; title: string; body: string };
/** The newest blog post, shown as a cover card. */
export type MenuPost = { href: string; title: string; meta: string; cover: string; alt: string };

/** A plain link, or a trigger that opens a panel of grouped links. */
export type NavEntry =
  | { label: string; href: string; columns?: undefined }
  | {
      label: string;
      href: string;
      /** Extra paths that should light this entry up, beyond its own links. */
      extraMatch?: string[];
      /** Panel width in px at desktop; the panel is centred under the nav. */
      width: number;
      columns: MenuColumn[];
      /** CSS grid-template-columns for the columns plus any card, when not equal-width. */
      layout?: string;
      featured?: MenuFeatured;
      latest?: MenuPost;
      viewAll: { label: string; href: string };
      /** A second footer link shown next to viewAll. */
      alsoViewAll?: { label: string; href: string };
    };

const SOLUTION_ICONS: Record<string, IconName> = {
  "manpower-erp-uae": "dashboard",
  "wps-payroll-software-uae": "wps",
  "timesheet-software-construction-uae": "clock",
  "construction-invoicing-software-uae": "receipt",
  "manpower-demand-mobilization-software-uae": "send",
  "camp-accommodation-management-software-uae": "bed",
  "supplier-portal-software-uae": "truck",
  "employee-self-service-portal-uae": "phone",
  "ai-assistant-workforce-management": "bot",
};

/** Pull a solution page out of SOLUTIONS_DATA by slug so the menu can never
 * drift from the pages that actually exist — a typo here fails the build. */
function solution(slug: keyof typeof SOLUTION_ICONS, short?: string, tag?: string): MenuItem {
  const found = SOLUTIONS_DATA.find((sol) => sol.slug === slug);
  if (!found) throw new Error(`nav-data: no solution page with slug "${slug}"`);
  return {
    label: found.label,
    href: `/${found.slug}`,
    description: short ?? found.description,
    icon: SOLUTION_ICONS[slug],
    tag,
  };
}

const PRODUCT: NavEntry = {
  label: "Product",
  href: "/features",
  extraMatch: ["/solutions"],
  width: 1060,
  layout: "1fr 1fr 1fr 1.05fr",
  columns: [
    {
      title: "The platform",
      tint: true,
      items: [
        solution("manpower-erp-uae", "Timesheets, payroll, billing and compliance in one system"),
        solution("ai-assistant-workforce-management", "Ask your workforce data a question", "New"),
      ],
    },
    {
      title: "Capabilities",
      tint: true,
      items: [
        solution("timesheet-software-construction-uae", "Excel, manual and supplier hours in one queue"),
        solution("wps-payroll-software-uae", "Payroll from approved hours, with a bank-ready SIF file", "Popular"),
        solution("construction-invoicing-software-uae", "VAT invoices from the same approved hours"),
      ],
    },
    {
      title: "Operations & portals",
      tint: true,
      items: [
        solution("manpower-demand-mobilization-software-uae", "Every client request, enquiry to demobilisation"),
        solution("camp-accommodation-management-software-uae", "Bed-level occupancy and transport routes"),
        solution("employee-self-service-portal-uae", "Payslips and attendance on any phone"),
        solution("supplier-portal-software-uae", "Subcontractors submit crews and hours"),
      ],
    },
  ],
  featured: {
    image: { src: "/brand-assets/sol-erp-dash.webp", width: 1400, height: 940, alt: "The ManpowerSync dashboard" },
    title: "See it on your own data",
    body: "A 30-minute walkthrough with your own timesheet workbook.",
  },
  viewAll: { label: "See all features", href: "/features" },
};

/** Short, true one-liners for the industry menu; the full text lives on each industry page. */
const INDUSTRY_SHORT: Record<string, string> = {
  "construction-manpower-software-uae": "Trades, sites and camps",
  "mep-contracting-workforce-software-uae": "Specialist trades billed by the hour",
  "facilities-management-workforce-software-uae": "Many small contracts, tracked together",
  "cleaning-hospitality-workforce-software-uae": "Shift-based teams with fast turnover",
  "oil-gas-workforce-software-uae": "Clearances and medical certification",
  "security-services-workforce-software-uae": "Guards posted to fixed sites",
};
const industryItem = (i: (typeof INDUSTRIES_DATA)[number], icon: IconName): MenuItem => ({
  label: i.name,
  href: `/industries/${i.slug}`,
  description: INDUSTRY_SHORT[i.slug] ?? i.description,
  icon,
});

const SOLUTIONS: NavEntry = {
  label: "Solutions",
  href: "/industries",
  width: 880,
  layout: "0.95fr 1fr 1fr",
  columns: [
    {
      title: "By need",
      tint: true,
      items: [
        solution("wps-payroll-software-uae", "Salary file for your bank"),
        solution("timesheet-software-construction-uae", "Hours from every site"),
        solution("construction-invoicing-software-uae", "Bill what was approved"),
        solution("supplier-portal-software-uae", "Subcontractors self-serve"),
      ],
    },
    { title: "By industry", items: INDUSTRIES_DATA.slice(0, 3).map((i) => industryItem(i, "hardhat")) },
    { title: " ", items: INDUSTRIES_DATA.slice(3).map((i) => industryItem(i, "building")) },
  ],
  viewAll: { label: "All industries", href: "/industries" },
  alsoViewAll: { label: "All solutions", href: "/solutions" },
};

const COVER_BY_CLUSTER: Record<string, string> = {
  "payroll-wps": "/brand-assets/blog-cover-payroll.webp",
  compliance: "/brand-assets/blog-cover-compliance.webp",
  "timesheets-billing": "/brand-assets/blog-cover-timesheets.webp",
  "operations-buying": "/brand-assets/blog-cover-operations.webp",
};
const NEWEST = [...POSTS].sort((a, b) => b.date.localeCompare(a.date))[0];

const RESOURCES: NavEntry = {
  label: "Resources",
  href: "/guides",
  width: 820,
  layout: "1fr 1fr 1.05fr",
  columns: [
    {
      title: "Learn",
      items: [
        { label: "Guides", href: "/guides", description: "How to run each part of the platform", icon: "document" },
        { label: "Blog", href: "/blog", description: "UAE payroll, WPS and compliance", icon: "sheet" },
        { label: "Compare", href: "/compare", description: "ManpowerSync vs Excel and an HRMS", icon: "check" },
        { label: "FAQ", href: "/faq", description: "Setup, data and pricing", icon: "check" },
      ],
    },
    {
      title: "Free tools",
      items: [
        { label: "WPS SIF file checker", href: "/tools/wps-sif-file-checker", description: "Catch errors before your bank does", icon: "wps" },
        { label: "Gratuity calculator", href: "/tools/gratuity-calculator-uae", description: "Dubai, Abu Dhabi and the rest", icon: "wallet" },
        { label: "All free tools", href: "/tools", description: "Calculators, validators, templates", icon: "wallet" },
      ],
    },
  ],
  latest: {
    href: `/blog/${NEWEST.slug}`,
    title: NEWEST.title,
    meta: new Date(NEWEST.date).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" }),
    cover: COVER_BY_CLUSTER[NEWEST.cluster],
    alt: "",
  },
  viewAll: { label: "Browse all guides", href: "/guides" },
};

/** The one primary nav for every page, homepage included. */
export const SITE_NAV: NavEntry[] = [PRODUCT, SOLUTIONS, RESOURCES, { label: "Pricing", href: "/pricing" }];

/** Every href the nav can reach, used to resolve the active entry. */
export function navHrefs(entry: NavEntry): string[] {
  if (!entry.columns) return [entry.href];
  return [entry.href, ...(entry.extraMatch ?? []), ...entry.columns.flatMap((c) => c.items.map((i) => i.href))];
}
