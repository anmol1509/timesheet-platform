import type { Metadata } from "next";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { CalendarDays, FileText, FolderOpen, Smartphone, Wallet } from "lucide-react";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "Employee Self-Service Portal UAE";
const DESCRIPTION =
  "Workers check their attendance, download payslips and view their own documents from any phone browser. No app to install, no call to HR needed.";
const URL = "https://manpowersync.com/employee-self-service-portal-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["employee self service portal UAE", "worker payslip app UAE", "employee portal manpower software", "construction worker attendance app UAE"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "What can a worker see in the portal?", a: "Their own payslips, attendance history and personal documents, including passport, visa, Emirates ID and labour card details with expiry dates." },
  { q: "Does it work on any phone?", a: "Yes. It runs in any phone browser with no app to install and no minimum phone spec; a worker opens a link and signs in." },
  { q: "When does a payslip appear?", a: "Each month's payslip can be downloaded the day the payroll run is approved, with the same figures payroll approved." },
] as const;

export default function EmployeeSelfServicePage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.cyan,
        hero: {
          pill: "Employee self-service",
          pillIcon: <Smartphone size={14} aria-hidden />,
          title: (
            <>
              An <em>employee self-service portal</em> for UAE workers
            </>
          ),
          lead: "Every worker's payslip, in their own pocket. Attendance, payslips and documents from any phone browser, with nothing to install.",
          ticks: ["Runs in any phone browser", "Payslips the day the run is approved", "Their own documents and expiry dates"],
          secondaryCta: { href: "/wps-payroll-software-uae", label: "See WPS payroll" },
          image: shot("sol-ess-home.webp", 780, 740, "The employee portal on a phone: Anil Sharma, DM-0006, Mason, and the latest payslip of AED 2,471.88 for 2026-09, approved."),
          badge: { icon: <Wallet size={18} aria-hidden />, title: "Payslip ready", sub: "The day the run is approved" },
          slice: {
            label: "Latest payslip · 2026-09",
            amount: "AED 2,471.88",
            meta: "Approved · downloadable as a PDF",
            steps: [
              { name: "Hours", state: "done" },
              { name: "Payroll", state: "done" },
              { name: "Approved", state: "done" },
              { name: "Payslip", state: "now" },
            ],
            button: "Open payslip",
            icon: <FileText size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "0", label: "apps to install: it runs in the phone's browser" },
          { value: "3", label: "things a worker can check: payslips, attendance, documents" },
          { value: "0", label: "calls to HR for \"what did I get paid?\"" },
          { value: "1", label: "set of figures: the same ones payroll approved" },
        ],
        how: {
          eyebrow: "Built for the site, not the office",
          title: "A portal your workforce will actually use.",
          lead: "No app store, no download, no minimum phone spec. A worker opens a link, signs in and sees their own record.",
          steps: [
            { title: "A worker signs in", body: "They open a link in their phone browser and land on their own record: name, ID, trade, site and the latest payslip.", image: shot("sol-ess-home.webp", 780, 740, "The employee portal home on a phone showing the worker's details and latest payslip.") },
            { title: "They open their payslips", body: "Every month's payslip appears once the payroll run is approved, with the same figures payroll approved, and a full history behind it.", image: shot("sol-ess-pay.webp", 780, 490, "The Payslips tab on a phone listing 2026-09, Approved, AED 2,471.88.") },
            { title: "They see the breakdown", body: "Basic, allowances, overtime and net pay on a payslip they can open on the bus, instead of asking HR.", image: shot("wps-payslip.webp", 900, 693, "A monthly payslip showing basic salary, allowances, overtime, total earnings and net pay.") },
          ],
        },
        features: {
          eyebrow: "The portal",
          title: "Payslips, attendance and documents, on any phone.",
          lead: "Questions like \"what did I get paid?\" and \"how many days did I work?\" stop needing a phone call.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <Smartphone size={22} aria-hidden />, title: "Runs in any phone browser. Nothing to install.", body: "No app store, no download, no minimum phone spec. A worker opens a link, signs in, and sees their own record.", list: ["Works on any phone browser", "Own record only", "Separate from the staff sign-in"], image: { ...shot("sol-ess-pay.webp", 780, 490, "The Payslips tab on a phone."), fade: true } },
            { tone: "tint", span2: true, icon: <Wallet size={22} aria-hidden />, title: "Payslips", body: "Every month's payslip, downloadable the day the run is approved.", chips: ["Monthly payslips", "Download as PDF", "Full history"] },
            { tone: "sky", icon: <CalendarDays size={22} aria-hidden />, title: "Attendance history", body: "Days worked, overtime and absence, as approved.", list: ["Days and overtime", "Absence records"] },
            { tone: "violet", icon: <FolderOpen size={22} aria-hidden />, title: "Documents", body: "Passport, visa, Emirates ID, labour card.", chips: ["Expiry dates"] },
            { span2: true, icon: <FileText size={22} aria-hidden />, title: "The same figures payroll approved", body: "Basic, allowances, overtime and net pay on the payslip match the approved payroll run, so there's nothing to reconcile.", zoom: shot("wps-payslip.webp", 900, 693, "A monthly payslip showing basic salary, allowances, overtime, total earnings and net pay.") },
            { span2: true, icon: <FolderOpen size={22} aria-hidden />, title: "Their own documents, in one place", body: "Passport, visa, Emirates ID and labour card details a worker is entitled to see are available directly, instead of scattered across paper copies.", log: [{ what: "Emirates ID", who: "Expiry date shown" }, { what: "Visa", who: "Expiry date shown" }, { what: "Labour card", who: "Expiry date shown" }] },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Payslips without the queue at HR.",
          before: { tag: "Paper and phone calls", title: "Everything goes through HR", items: ["Payslips printed and handed out", "\"How many days did I work?\" asked by phone", "Document copies scattered or lost", "HR answers the same questions monthly", "Workers wait for the office to open"] },
          after: { tag: "With ManpowerSync", title: "Workers look it up themselves", items: ["Payslips on their phone the day the run is approved", "Attendance history on demand", "Own documents and expiry dates in one place", "Fewer repeat questions to HR", "Any phone browser, any time"] },
        },
        related: {
          eyebrow: "The other portals",
          title: "Connected modules.",
          cards: [
            { href: "/supplier-portal-software-uae", title: "Supplier portal", body: "Subcontractors submitting their own workers, timesheets and tracking payments." },
            { href: "/manpower-erp-uae", title: "Manpower ERP", body: "The staff workspace behind both portals: approvals, payroll, billing and compliance." },
          ],
        },
        furtherReading: postsForPillar("/employee-self-service-portal-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: "Give your workforce their own portal.", lead: `Workers can sign in and see their first payslip the same day it's run on ${SITE.name}.` },
      }}
    />
  );
}
