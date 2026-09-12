/**
 * The dashboard is one destination with per-domain tabs rather than nine
 * separate "Dashboard" rows in the sidebar. Each tab is a real route, so tabs
 * stay deep-linkable and server-rendered — nothing here duplicates a page.
 */
export const DASHBOARD_TABS = [
  { href: "/", label: "Overview" },
  { href: "/dashboards/workforce", label: "Workforce" },
  { href: "/dashboards/projects", label: "Projects" },
  { href: "/dashboards/demand", label: "Demand" },
  { href: "/dashboards/facilities", label: "Facilities" },
  { href: "/dashboards/timesheets", label: "Timesheets" },
  { href: "/dashboards/business-partners", label: "Partners" },
  { href: "/dashboards/sales", label: "Sales" },
  { href: "/dashboards/billing", label: "Billing" },
] as const;
