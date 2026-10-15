// Registry of comparison pages at /compare/<slug>. The hub, sitemap, footer and
// Resources menu read from this; a new comparison is one entry plus its folder.
export const COMPARISONS = [
  {
    slug: "manpowersync-vs-excel",
    label: "ManpowerSync vs Excel",
    title: "ManpowerSync vs Excel for Manpower Suppliers",
    description:
      "Where Excel still works for a UAE manpower supplier, where it breaks, and what changes when timesheets, WPS payroll and invoicing run from one system.",
    updated: "2026-10-14",
  },
  {
    slug: "manpower-erp-vs-hrms",
    label: "Manpower ERP vs HRMS",
    title: "Manpower ERP vs a General HRMS (UAE)",
    description:
      "What a general HRMS covers, what a manpower supplier needs on top (client billing, deployments, visas, camps, subcontractors), and how to decide.",
    updated: "2026-10-14",
  },
] as const;
