import type { Metadata } from "next";
import { CalendarCheck, ClipboardList, FileSpreadsheet, History, Layers, Send, Timer } from "lucide-react";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "Construction Timesheet Software UAE";
const DESCRIPTION =
  "Bring in hours from Excel workbooks, manual entry or supplier submissions, apply overtime and rest-day rules automatically, and send approved hours straight to invoices and payroll.";
const URL = "https://manpowersync.com/timesheet-software-construction-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["timesheet software construction UAE", "construction timesheet software Dubai", "manpower timesheet app UAE", "attendance software construction UAE", "client timesheet software UAE"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "What ways can hours come into the system?", a: "As the consolidated Excel workbook your sites already send, entered manually for a site with no system, or submitted by a subcontractor through their own portal. One system reconciles all three." },
  { q: "How are overtime and exceptions handled?", a: "They are flagged as hours arrive rather than worked out by hand at month end, and supervisors approve in one queue with every change recorded in the audit log." },
  { q: "Do approved hours have to be re-entered for payroll and invoices?", a: "No. The same approved hours become client invoices and payroll input, so nothing is retyped between the teams that track attendance and the teams that bill and pay." },
] as const;

export default function TimesheetSoftwarePage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.blue,
        hero: {
          pill: "Timesheets & attendance",
          pillIcon: <Timer size={14} aria-hidden />,
          title: (
            <>
              <em>Construction timesheet software</em> for the UAE
            </>
          ),
          lead: "Enter hours once. Overtime and rest-day rules are applied as they arrive, and the approved hours flow straight to invoices and payroll.",
          ticks: ["Upload your workbook as it is", "Overtime flagged as hours come in", "One approval queue for every site"],
          secondaryCta: { href: "/tools/construction-timesheet-template", label: "Get the free timesheet template" },
          image: shot("sol-ts-client.webp", 1400, 800, "A September client timesheet in ManpowerSync: six workers with trade, status and a day-by-day grid of hours, Fridays marked OFF."),
          badge: { icon: <CalendarCheck size={18} aria-hidden />, title: "Client approved", sub: "Ready to invoice" },
          slice: {
            label: "Client timesheet · Sep 2026",
            amount: "1,428 h",
            meta: "6 workers · Al Futtaim Engineering",
            steps: [
              { name: "Draft", state: "done" },
              { name: "Submitted", state: "done" },
              { name: "Approved", state: "done" },
              { name: "Invoiced", state: "now" },
            ],
            button: "Invoice these hours",
            icon: <Send size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "3", label: "ways hours arrive: workbook, manual entry, supplier portal" },
          { value: "1", label: "approval queue instead of a dozen separate sheets" },
          { value: "0", label: "re-entry between attendance, invoices and payroll" },
          { value: "100%", label: "of edits recorded in the audit log" },
        ],
        how: {
          eyebrow: "However hours arrive",
          title: "From hours to paid, in three steps.",
          lead: "The same consolidated workbook your sites already send, a site with no system, or a subcontractor's own submission: one system reconciles all three.",
          steps: [
            { title: "Hours come in", body: "Upload the monthly Excel workbook as it is and every month tab is detected, enter hours by hand for a site with no system, or let a subcontractor submit through their own portal.", image: shot("sol-ts-client.webp", 1400, 800, "The client timesheet with each worker's daily hours for September and a status per worker.") },
            { title: "Approve in one queue", body: "Overtime over threshold, missing days and rest-day work are flagged as hours arrive, so supervisors sign off in one place and every change lands in the audit log.", image: shot("wps-approval.webp", 694, 390, "The approvals inbox showing an item waiting for a second person, with Send back and Approve buttons.") },
            { title: "Hours flow on", body: "The same approved hours become client invoices at each client's own rate and the input to payroll, so nothing is retyped between teams.", image: shot("sol-billing.webp", 1400, 940, "The billing overview showing invoices issued from approved hours, grouped by client."), top: true },
          ],
        },
        features: {
          eyebrow: "The module",
          title: "Timesheets & attendance, without the month-end scramble.",
          lead: "Excel workbook import, manual and client timesheets, overtime and rest-day rules, and one approval queue.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <FileSpreadsheet size={22} aria-hidden />, title: "Hours arrive however your sites actually work", body: "The same consolidated Excel workbook your sites already send in, entered manually for a site with no system, or submitted by a subcontractor through their own portal. One system reconciles all three.", list: ["Excel workbook import, every month tab detected", "Manual and daily entry for sites without a system", "Subcontractor hours through the supplier portal"], image: { ...shot("sol-ts-client.webp", 1400, 800, "The client timesheet grid of daily hours."), fade: true } },
            { tone: "tint", span2: true, icon: <Layers size={22} aria-hidden />, title: "Overtime and rest-day rules applied automatically", body: "Exceptions and overtime are flagged as hours come in, not worked out by hand at month end.", chips: ["Overtime", "Rest days", "Absence", "Missing days"] },
            { tone: "sky", icon: <ClipboardList size={22} aria-hidden />, title: "One approval queue", body: "Supervisors sign off in one place instead of chasing separate sheets.", list: ["Per-worker status", "Client approval"] },
            { tone: "violet", icon: <Send size={22} aria-hidden />, title: "Straight to invoices and payroll", body: "Approved hours are never retyped.", chips: ["Invoices", "Payroll"] },
            { span2: true, icon: <History size={22} aria-hidden />, title: "A trail for every edit", body: "Edits to hours are recorded with who changed what and when, so a disputed day has an answer.", log: [{ what: "Hours corrected for one day", who: "Old and new value kept" }, { what: "Submitted for client approval", who: "Status moves to Submitted" }, { what: "Client approved", who: "Hours locked for invoicing" }] },
            { span2: true, icon: <Timer size={22} aria-hidden />, title: "From hours to a worker's pay", body: "The same approved days drive payroll: salary for the days worked, overtime hours and absence, with each day's total and the net pay for the month.", image: { ...shot("wps-days.webp", 1100, 885, "Day-by-day pay for one worker: salary for the days, overtime hours and absence, with each day's total and the net pay for the month."), fade: true } },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Timesheets without the chase.",
          before: { tag: "Workbooks by email", title: "Rebuilt every month", items: ["A dozen site sheets in a dozen layouts", "Overtime worked out by hand at month end", "Subcontractor hours retyped from emails", "Approved hours retyped again for billing and payroll", "No record of who changed a day"] },
          after: { tag: "With ManpowerSync", title: "Entered once, used everywhere", items: ["Workbooks uploaded as they are", "Exceptions flagged as hours arrive", "Suppliers submit through their portal", "The same hours feed invoices and payroll", "Every edit in the audit log"] },
          note: (
            <>
              Need a layout to start from? Download the <a href="/tools/construction-timesheet-template" style={{ fontWeight: 600, color: "var(--primary)" }}>free timesheet template</a>.
            </>
          ),
        },
        related: {
          eyebrow: "What approved hours feed",
          title: "Where the hours go next.",
          cards: [
            { href: "/wps-payroll-software-uae", title: "WPS payroll software", body: "Approved hours become a payroll run and a bank-ready WPS salary file, without re-entry." },
            { href: "/construction-invoicing-software-uae", title: "Billing & VAT invoicing", body: "The same approved hours become VAT-ready client invoices at each client's own agreed rate." },
          ],
        },
        furtherReading: postsForPillar("/timesheet-software-construction-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: `Bring this month's timesheets to ${SITE.name}.`, lead: "Upload your current workbook as it is. Every month tab is detected and reconciled automatically." },
      }}
    />
  );
}
