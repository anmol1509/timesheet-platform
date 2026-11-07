import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import type { ClusterSlug } from "./clusters";
import type { Post } from "./posts";

/** Generated cover (1200x630) and accent colour for each topic cluster; the file sits in /public/brand-assets. */
export const COVERS: Record<ClusterSlug, { src: string; alt: string; accent: (typeof ACCENTS)[keyof typeof ACCENTS] }> = {
  "payroll-wps": { src: "/brand-assets/blog-cover-payroll.webp", alt: "A payroll statement with a green tick and a stack of coins", accent: ACCENTS.mint },
  compliance: { src: "/brand-assets/blog-cover-compliance.webp", alt: "A shield with a tick in front of two ID cards", accent: ACCENTS.violet },
  "timesheets-billing": { src: "/brand-assets/blog-cover-timesheets.webp", alt: "A monthly timesheet calendar with a bar chart and a tick", accent: ACCENTS.blue },
  "operations-buying": { src: "/brand-assets/blog-cover-operations.webp", alt: "Two camp buildings and a staff bus", accent: ACCENTS.orange },
};

/** Article-specific editorial photography; the cluster cover remains a fallback for new posts. */
const ARTICLE_COVERS: Record<string, { src: string; alt: string }> = {
  "reconcile-site-attendance-timesheets-invoices": { src: "/brand-assets/blog/reconcile.webp", alt: "A construction manager comparing timesheets and an invoice at a site office desk" },
  "manpower-contract-profitability-billable-hours": { src: "/brand-assets/blog/profit.webp", alt: "A contractor reviewing workforce costs and billable hours" },
  "manpower-deployment-handover-checklist": { src: "/brand-assets/blog/deployment.webp", alt: "A supervisor welcoming workers to a construction site" },
  "payroll-month-end-checklist-labour-suppliers": { src: "/brand-assets/blog/payroll.webp", alt: "A payroll administrator reviewing a month-end checklist" },
  "employee-time-recording-software-uae": { src: "/brand-assets/blog/recording.webp", alt: "A construction worker recording attendance on a tablet" },
  "best-employee-time-tracking-software-uae": { src: "/brand-assets/blog/timechoice.webp", alt: "An operations manager comparing ways to track employee time" },
  "wps-sif-rejection-reasons-uae": { src: "/brand-assets/blog/wps.webp", alt: "A payroll specialist checking a rejected salary file" },
  "visa-emirates-id-expiry-compliance-checklist": { src: "/brand-assets/blog/expiry.webp", alt: "An HR administrator checking document expiry dates" },
  "eosb-gratuity-calculation-uae": { src: "/brand-assets/blog/gratuity.webp", alt: "A calculator and anonymised end-of-service settlement documents" },
  "uae-overtime-rules-construction-workers": { src: "/brand-assets/blog/overtime.webp", alt: "A construction crew at work in the late afternoon" },
  "labour-card-work-permit-visa-difference-uae": { src: "/brand-assets/blog/permits.webp", alt: "A passport and sample work and residency documents" },
  "how-to-price-manpower-supply-uae-hourly-rate": { src: "/brand-assets/blog/pricing.webp", alt: "A labour supplier calculating workforce costs and hourly rates" },
  "construction-timesheet-format-labour-supply-uae": { src: "/brand-assets/blog/timesheet.webp", alt: "A site supervisor completing a construction timesheet" },
  "manpower-supply-software-uae-buyers-checklist": { src: "/brand-assets/blog/buyer.webp", alt: "An operations manager comparing workforce software" },
  "stop-client-timesheet-disputes-labour-supply-invoices": { src: "/brand-assets/blog/disputes.webp", alt: "Colleagues reviewing a timesheet and an invoice together" },
  "labour-camp-occupancy-beds-checkins-cost-per-bed": { src: "/brand-assets/blog/camp.webp", alt: "Workforce accommodation and a shuttle bus" },
  "uae-gratuity-rules-eligibility": { src: "/brand-assets/blog/eligibility.webp", alt: "An HR professional reviewing an employment contract and service history" },
  "final-settlement-uae-labour-law": { src: "/brand-assets/blog/settlement.webp", alt: "An HR manager preparing an employment settlement" },
};

export function coverFor(post: Pick<Post, "slug" | "cluster">) {
  return { ...COVERS[post.cluster], ...ARTICLE_COVERS[post.slug] };
}
