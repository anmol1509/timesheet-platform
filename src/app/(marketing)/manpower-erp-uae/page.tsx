import type { Metadata } from "next";
import { BedDouble, Building2, ClipboardCheck, FileCheck2, Receipt, ShieldCheck, Users } from "lucide-react";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { finishMetadata } from "@/lib/seo/metadata";
import { FACTS, SITE } from "@/app/(marketing)/welcome/content";
import { SOLUTIONS_DATA } from "@/app/(marketing)/solutions/solutions-data";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "Manpower ERP for UAE Labour Suppliers";
const DESCRIPTION =
  "A manpower ERP built for UAE labour supply companies: timesheets, WPS payroll, client billing, visa/Emirates ID compliance, camps and transport in one system.";
const URL = "https://manpowersync.com/manpower-erp-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["manpower ERP", "manpower ERP UAE", "manpower ERP software", "manpower management software UAE", "labour supply ERP Dubai"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "What does a manpower ERP include?", a: "Timesheets and attendance, payroll with a WPS export, client billing, projects, sites and demand tracking, documents and compliance, camps and transport, and portals for staff, employees and suppliers, all on one set of records." },
  { q: "Do we have to re-key our existing data?", a: "No. Employees and sites are imported from your existing sheets, and your current timesheet workbook can be uploaded as it is." },
  { q: "Who can see salary and client data?", a: "Access is controlled by role and company, so each person only sees the modules they need, and every create, edit and delete is recorded in the audit log." },
] as const;

export default function ManpowerErpUaePage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.indigo,
        hero: {
          pill: "Manpower ERP",
          pillIcon: <Building2 size={14} aria-hidden />,
          title: (
            <>
              <em>Manpower ERP</em> for UAE labour suppliers
            </>
          ),
          lead: "Your whole manpower business in one system: the hours your supervisors approve are the hours you bill and the hours you pay.",
          ticks: ["Bring your Excel timesheets, no re-keying", "Visa and Emirates ID expiries surfaced early", "Three portals: staff, employee and supplier"],
          secondaryCta: { href: "/features", label: "See every module" },
          image: shot("sol-erp-dash.webp", 1400, 940, "The ManpowerSync dashboard for a 34-worker supplier: workforce total, deployment at 74%, active clients and a list of what needs attention today."),
          badge: { icon: <ShieldCheck size={18} aria-hidden />, title: "One audit log", sub: "Every change recorded" },
          slice: {
            label: "Workforce · today",
            amount: "34 workers",
            meta: "25 deployed · 9 on bench",
            steps: [
              { name: "Hours", state: "done" },
              { name: "Payroll", state: "done" },
              { name: "Billing", state: "done" },
              { name: "Compliance", state: "now" },
            ],
            button: "Open dashboard",
            icon: <ClipboardCheck size={16} aria-hidden />,
          },
        },
        proof: FACTS,
        how: {
          eyebrow: "One month, one system",
          title: "From a worker's hours to the bank and the invoice.",
          lead: "Operations, HR, payroll and finance share one set of records, so nothing is retyped between the people who track attendance and the people who bill and pay.",
          steps: [
            { title: "Bring in your people and hours", body: "Import employees and sites from your existing sheets, and upload your timesheet workbook as it is: every month tab is detected and reconciled against your roster.", image: shot("sol-ts-client.webp", 1400, 800, "A client timesheet for September with each worker's day-by-day hours, trade and approval status.") },
            { title: "Approve once, then pay", body: "Supervisors approve in one queue. The same approved hours feed payroll, with overtime applied, a second person approving above your limit, and a WPS file for the bank.", image: shot("wps-run-main.webp", 1400, 1085, "An approved payroll run showing net pay, headcount, the four process steps and the Bank file (WPS) button."), top: true },
            { title: "Bill the same hours", body: "Each client's invoice is built from the hours their own approver signed off, at their agreed rates, with VAT calculated and unpaid invoices chased from one dashboard.", image: shot("sol-billing.webp", 1400, 940, "The billing overview with invoices issued, paid and overdue, and a chart of invoiced value by client."), top: true },
            { title: "Keep people housed and compliant", body: "Camps, beds and transport sit on the same worker records, and visa, Emirates ID and labour card expiries are surfaced long before they become a fine.", image: shot("sol-camps.webp", 1400, 940, "The camps screen with total beds, occupancy and room-by-room bed allocation.") },
          ],
        },
        features: {
          eyebrow: "Why not a generic HR system",
          title: "Built for a workforce you bill by the hour.",
          lead: "A general HRMS stops at employee records and internal payroll. A manpower ERP also bills your clients and runs your sites.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <Receipt size={22} aria-hidden />, title: "Hours become invoices and payroll, from one approval", body: "A generic HRMS stops at employee records and internal payroll. Here the same approved hours become client invoices, track which client each worker is deployed to, and handle subcontractor crews as first-class citizens.", list: ["Client invoices at each client's own rate", "Payroll input from the same hours", "Subcontractor crews on the same records"], image: { ...shot("sol-demand.webp", 1400, 690, "The demand request list with client, trades, allocation progress and supplier offers."), fade: true } },
            { tone: "tint", span2: true, icon: <ShieldCheck size={22} aria-hidden />, title: "UAE compliance is the day-to-day job", body: "Visa, Emirates ID, labour card and passport expiries drive daily operations for a supplier, so they are surfaced before they become a fine.", chips: ["Visa", "Emirates ID", "Labour card", "Passport", "Medical"] },
            { tone: "sky", icon: <FileCheck2 size={22} aria-hidden />, title: "A WPS file your bank accepts", body: "Bank details, salary structure and the SIF export come from the record.", list: ["Four-eyes approval", "Re-exportable file"] },
            { tone: "violet", icon: <Users size={22} aria-hidden />, title: "Three portals", body: "Staff, employee and supplier each sign in to their own view.", chips: ["Staff", "Employee", "Supplier"] },
            { span2: true, icon: <BedDouble size={22} aria-hidden />, title: "Camps and transport on the same records", body: "Bed-level occupancy, check-in history, vehicles and pickup routes, planned against the sites crews work at today.", image: { ...shot("sol-beds.webp", 1400, 940, "The bed allocation screen listing each worker with their camp, room and bed."), fade: true } },
            { span2: true, icon: <ClipboardCheck size={22} aria-hidden />, title: "Roles, companies and a full audit trail", body: "Access is controlled by role and company, and every create, edit and delete is recorded.", log: [{ what: "Payroll run approved", who: "By a second person" }, { what: "Employee bank details changed", who: "Recorded with who and when" }, { what: "Timesheet rate corrected", who: "Old and new value kept" }] },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "From five spreadsheets to one set of records.",
          before: { tag: "Spreadsheets and a generic HR tool", title: "Everyone keeps their own version", items: ["Timesheets, payroll and invoices rebuilt in separate files", "Expiry dates tracked in a calendar someone remembers to open", "Subcontractor hours arrive by email", "Camp beds known by phoning the camp boss", "No record of who changed a figure"] },
          after: { tag: "With ManpowerSync", title: "One record, many views", items: ["The same approved hours feed billing and payroll", "Expiries surfaced automatically, with the document", "Suppliers submit through their own portal", "Live occupancy by room and bed", "Every change in the audit log"] },
          note: (
            <>
              Comparing options? See <a href="/compare/manpowersync-vs-excel" style={{ fontWeight: 600, color: "var(--primary)" }}>ManpowerSync vs Excel</a>.
            </>
          ),
        },
        related: {
          eyebrow: "Go deeper",
          title: "Each piece, in detail.",
          cards: SOLUTIONS_DATA.filter((s) => s.slug !== "manpower-erp-uae").map((s) => ({ href: `/${s.slug}`, title: s.label, body: s.description })),
        },
        furtherReading: postsForPillar("/manpower-erp-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: `See ${SITE.name} on your own workforce.`, lead: "Bring your current timesheet workbook. Nothing to re-key before your first month." },
      }}
    />
  );
}
