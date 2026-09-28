import { INDUSTRIES_DATA } from "@/app/industries/industries-data";
import { SOLUTIONS_DATA } from "@/app/solutions/solutions-data";
import type { IconName } from "./content-blocks";

export type MenuItem = { label: string; href: string; description?: string; icon?: IconName };
export type MenuColumn = { title: string; items: MenuItem[] };

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
      viewAll: { label: string; href: string };
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
function solution(slug: keyof typeof SOLUTION_ICONS): MenuItem {
  const found = SOLUTIONS_DATA.find((sol) => sol.slug === slug);
  if (!found) throw new Error(`nav-data: no solution page with slug "${slug}"`);
  return {
    label: found.label,
    href: `/${found.slug}`,
    description: found.description,
    icon: SOLUTION_ICONS[slug],
  };
}

const PRODUCT: NavEntry = {
  label: "Product",
  href: "/features",
  extraMatch: ["/solutions"],
  width: 940,
  columns: [
    {
      title: "The platform",
      items: [solution("manpower-erp-uae"), solution("ai-assistant-workforce-management")],
    },
    {
      title: "Capabilities",
      items: [
        solution("timesheet-software-construction-uae"),
        solution("wps-payroll-software-uae"),
        solution("construction-invoicing-software-uae"),
      ],
    },
    {
      title: "Operations & portals",
      items: [
        solution("manpower-demand-mobilization-software-uae"),
        solution("camp-accommodation-management-software-uae"),
        solution("employee-self-service-portal-uae"),
        solution("supplier-portal-software-uae"),
      ],
    },
  ],
  viewAll: { label: "See all features", href: "/features" },
};

const SOLUTIONS: NavEntry = {
  label: "Solutions",
  href: "/industries",
  width: 560,
  columns: [
    {
      title: "By industry",
      items: INDUSTRIES_DATA.slice(0, 3).map((i) => ({
        label: i.name,
        href: `/industries/${i.slug}`,
        icon: "hardhat" as IconName,
      })),
    },
    {
      title: " ",
      items: INDUSTRIES_DATA.slice(3).map((i) => ({
        label: i.name,
        href: `/industries/${i.slug}`,
        icon: "building" as IconName,
      })),
    },
  ],
  viewAll: { label: "All industries", href: "/industries" },
};

const RESOURCES: NavEntry = {
  label: "Resources",
  href: "/guides",
  width: 340,
  columns: [
    {
      title: "Learn",
      items: [
        { label: "Guides", href: "/guides", description: "How to run each part of the platform.", icon: "document" },
        { label: "Blog", href: "/blog", description: "UAE payroll, WPS and compliance writing.", icon: "sheet" },
        { label: "FAQ", href: "/faq", description: "Straight answers on setup, data and pricing.", icon: "check" },
      ],
    },
  ],
  viewAll: { label: "Browse all guides", href: "/guides" },
};

/** The one primary nav for every page, homepage included. */
export const SITE_NAV: NavEntry[] = [PRODUCT, SOLUTIONS, RESOURCES, { label: "Pricing", href: "/pricing" }];

/** Every href the nav can reach, used to resolve the active entry. */
export function navHrefs(entry: NavEntry): string[] {
  if (!entry.columns) return [entry.href];
  return [entry.href, ...(entry.extraMatch ?? []), ...entry.columns.flatMap((c) => c.items.map((i) => i.href))];
}
