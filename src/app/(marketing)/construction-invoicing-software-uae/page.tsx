import type { Metadata } from "next";
import { BadgeCheck, Banknote, FileText, Percent, Receipt, Scale, Wallet } from "lucide-react";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "VAT Invoicing Software for Manpower Supply";
const DESCRIPTION =
  "Turn approved timesheet hours into VAT-ready client invoices, and keep bills, expenses and payments in one ledger instead of three separate spreadsheets.";
const URL = "https://manpowersync.com/construction-invoicing-software-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["construction invoicing software UAE", "VAT invoice software UAE manpower", "manpower billing software UAE", "client invoicing software construction UAE"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "Where do the invoice figures come from?", a: "From the hours a client's approver already signed off, multiplied by that client's agreed trade rates, so the invoice and payroll are built from the same approved hours." },
  { q: "Can different clients or projects have different rates?", a: "Yes. Rates are set per client, with overrides per project, so each invoice is generated against the rate agreed for that work." },
  { q: "Does it track unpaid invoices and what we owe suppliers?", a: "Yes. Invoices move through draft, sent, paid and overdue, with the overdue balance on the billing dashboard, and supplier bills, expenses and payments sit in the same ledger." },
] as const;

export default function InvoicingSoftwarePage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.amber,
        hero: {
          pill: "Billing & finance",
          pillIcon: <Receipt size={14} aria-hidden />,
          title: (
            <>
              <em>VAT invoicing software</em> for manpower supply
            </>
          ),
          lead: "Every approved hour, billed. Invoices are built from the same approved hours as payroll, at each client's own rate, with VAT worked out.",
          ticks: ["Per-client rates and project overrides", "VAT-ready by default", "Unpaid invoices chased from one dashboard"],
          secondaryCta: { href: "/compare/manpowersync-vs-excel", label: "Compare with Excel" },
          image: shot("sol-billing.webp", 1400, 940, "The ManpowerSync billing overview: three invoices issued, one paid, one overdue, AED 56,910 outstanding, and invoiced value by client."),
          badge: { icon: <BadgeCheck size={18} aria-hidden />, title: "Built from approved hours", sub: "Same hours as payroll" },
          slice: {
            label: "Invoiced · Sep 2026",
            amount: "AED 107,573",
            meta: "3 invoices · 3 clients",
            steps: [
              { name: "Hours", state: "done" },
              { name: "Invoice", state: "done" },
              { name: "Sent", state: "done" },
              { name: "Paid", state: "now" },
            ],
            button: "Chase overdue invoice",
            icon: <Wallet size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "1", label: "set of approved hours behind both invoices and payroll" },
          { value: "5%", label: "UAE VAT applied to each invoice" },
          { value: "4", label: "invoice states: draft, sent, paid, overdue" },
          { value: "3", label: "ledgers in one: invoices, supplier bills, expenses" },
        ],
        how: {
          eyebrow: "From hours to cash",
          title: "Close the gap between timesheets and invoices.",
          lead: "Stop letting approved hours slip away before they are billed: no separate billing spreadsheet to drift out of sync with what payroll paid.",
          steps: [
            { title: "Hours are approved", body: "The hours a client's timesheet approver signs off are the only hours that can be invoiced, so what you bill is what was approved.", image: shot("sol-ts-client.webp", 1400, 800, "The client timesheet with approved hours per worker for September.") },
            { title: "Invoices generate at the agreed rate", body: "Trade rates per client and per project are applied to those hours, with VAT calculated and the total ready to send. Nothing is re-keyed.", image: shot("sol-billing.webp", 1400, 940, "The billing overview with invoiced value split by client and an invoices-by-status chart."), top: true },
            { title: "Chase what's overdue", body: "The billing dashboard shows what is outstanding and what is past due, with the overdue invoices listed so the right client gets the right reminder.", image: shot("sol-assistant.webp", 1400, 940, "The assistant panel listing needs-attention items such as an overdue invoice and approved hours not yet invoiced, each with an Open button."), top: true },
          ],
        },
        features: {
          eyebrow: "The module",
          title: "Billing & finance in one ledger.",
          lead: "Client invoices, supplier bills, expenses and payments live together, not across three tools reconciled by hand at month end.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <Receipt size={22} aria-hidden />, title: "Invoices generated from the same approved hours as payroll", body: "The hours a client's approver signed off are the hours that become their invoice, so there's no separate billing spreadsheet that can drift out of sync with what payroll actually paid.", list: ["Per-client trade rates", "Per-project overrides", "Nothing re-keyed"], image: { ...shot("sol-billing.webp", 1400, 940, "The billing overview with invoices by client."), fade: true } },
            { tone: "tint", span2: true, icon: <Percent size={22} aria-hidden />, title: "VAT-ready by default", body: "Invoices are structured to match UAE VAT requirements, so finance isn't reformatting every export before it goes out.", chips: ["VAT calculated", "Totals ready to send", "Per-client billing"] },
            { tone: "sky", icon: <Scale size={22} aria-hidden />, title: "Know your margin", body: "Billed value against cost per client.", list: ["Margin per invoice", "Spot a loss early"] },
            { tone: "violet", icon: <Banknote size={22} aria-hidden />, title: "Payments tracked", body: "Paid, sent and overdue, per invoice.", chips: ["Paid", "Sent", "Overdue"] },
            { span2: true, icon: <Wallet size={22} aria-hidden />, title: "Bills, expenses and payments together", body: "What you owe suppliers, what you've spent and what clients have paid, with ageing and statements per partner.", list: ["Supplier bills and ageing", "Expenses with approvals", "Payment tracking"] },
            { span2: true, icon: <FileText size={22} aria-hidden />, title: "Same hours, both sides", body: "The approved hours also drive the payroll run, so what you bill and what you pay are built from one record.", image: { ...shot("wps-run-main.webp", 1400, 1085, "An approved payroll run built from the same approved hours."), fade: true } },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Billing without the leak.",
          before: { tag: "A billing spreadsheet", title: "Hours slip between teams", items: ["Billing sheet drifts from what payroll paid", "Rates copied between sheets by hand", "VAT reformatted at every export", "Unpaid invoices found at month end", "Bills, expenses and payments in three tools"] },
          after: { tag: "With ManpowerSync", title: "Billed from the record", items: ["Invoices from the approved hours", "Rates held per client and project", "VAT-ready invoices", "Overdue balance on one dashboard", "One ledger for the lot"] },
        },
        related: {
          eyebrow: "Where the hours come from",
          title: "Upstream and downstream.",
          cards: [
            { href: "/timesheet-software-construction-uae", title: "Timesheet software", body: "Excel, manual and supplier-submitted hours, reconciled and approved in one queue." },
            { href: "/wps-payroll-software-uae", title: "WPS payroll software", body: "The same approved hours, run through payroll and exported as a bank-ready WPS file." },
          ],
        },
        furtherReading: postsForPillar("/construction-invoicing-software-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: `Bill this month's approved hours on ${SITE.name}.`, lead: "See how much revenue is currently slipping through the gap between timesheets and invoices." },
      }}
    />
  );
}
