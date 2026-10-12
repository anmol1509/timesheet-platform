// Registry of product how-to guides — distinct from /blog (industry/
// compliance reading). The index page and sitemap both read from this.
export const GUIDES = [
  {
    slug: "getting-started-import-employees-timesheets",
    title: "Getting Started: Import Your Employees and Timesheets",
    description:
      "How to bring your existing workforce spreadsheet and current timesheet workbook into the system, without re-keying anyone by hand.",
    date: "2026-09-05",
  },
  {
    slug: "run-payroll-export-wps-file",
    title: "How to Run Payroll and Export a WPS File",
    description:
      "Setting each employee's pay structure, running a payroll from approved hours, and exporting the bank-ready WPS salary file.",
    date: "2026-09-12",
  },
  {
    slug: "setting-up-roles-permissions",
    title: "Setting Up Roles and Permissions for Your Team",
    description:
      "The difference between super admin, branch admin and staff, and how to build a custom access role for exactly what one person should see.",
    date: "2026-09-20",
  },
] as const;

export type Guide = (typeof GUIDES)[number];
