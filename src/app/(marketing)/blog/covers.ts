import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import type { ClusterSlug } from "./clusters";

/** Generated cover (1200x630) and accent colour for each topic cluster; the file sits in /public/brand-assets. */
export const COVERS: Record<ClusterSlug, { src: string; alt: string; accent: (typeof ACCENTS)[keyof typeof ACCENTS] }> = {
  "payroll-wps": { src: "/brand-assets/blog-cover-payroll.webp", alt: "A payroll statement with a green tick and a stack of coins", accent: ACCENTS.mint },
  compliance: { src: "/brand-assets/blog-cover-compliance.webp", alt: "A shield with a tick in front of two ID cards", accent: ACCENTS.violet },
  "timesheets-billing": { src: "/brand-assets/blog-cover-timesheets.webp", alt: "A monthly timesheet calendar with a bar chart and a tick", accent: ACCENTS.blue },
  "operations-buying": { src: "/brand-assets/blog-cover-operations.webp", alt: "Two camp buildings and a staff bus", accent: ACCENTS.orange },
};
