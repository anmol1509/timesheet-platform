import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { CAPABILITIES, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "VAT Invoicing & Billing Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Turn approved timesheet hours into VAT-ready client invoices, and keep bills, expenses and payments in one ledger instead of three separate spreadsheets.";
const URL = "https://manpowersync.com/construction-invoicing-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "construction invoicing software UAE",
    "VAT invoice software UAE manpower",
    "manpower billing software UAE",
    "client invoicing software construction UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const BILLING_CAPABILITY = CAPABILITIES.find((c) => c.title === "Billing & finance")!;

const DIFFERENTIATORS = [
  {
    title: "Invoices generated from the same approved hours as payroll",
    body: "The hours a client's timesheet approver signed off on are the same hours that become their invoice — no separate billing spreadsheet that can drift out of sync with what payroll actually paid.",
  },
  {
    title: "VAT-ready by default",
    body: "Invoices are structured to match UAE VAT requirements, so finance isn't reformatting every export before it goes out.",
  },
  {
    title: "Bills, expenses and payments in one ledger",
    body: "What you owe suppliers, what you've spent, and what clients have paid live together — not across three tools that need reconciling by hand at month end.",
  },
];

export default function InvoicingSoftwarePage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{TITLE}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{DESCRIPTION}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={demoHref}
            className="rounded-full bg-[var(--brand-primary,#5645d4)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Book a demo
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <h2 className="text-center text-2xl font-semibold text-slate-900">
          Stop letting approved hours leak away before they&rsquo;re billed
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          {DIFFERENTIATORS.map((d) => (
            <div key={d.title}>
              <h3 className="text-base font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">{BILLING_CAPABILITY.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{BILLING_CAPABILITY.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {BILLING_CAPABILITY.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14 text-center">
        <p className="text-slate-600">
          Invoicing runs from the same approved hours as{" "}
          <Link href="/timesheet-software-construction-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            timesheets
          </Link>{" "}
          and{" "}
          <Link href="/wps-payroll-software-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            payroll
          </Link>
          .
        </p>
      </section>

      <section className="bg-slate-50 py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Bill this month&rsquo;s approved hours on {SITE.name}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">See how much revenue is currently slipping through the gap between timesheets and invoices.</p>
        <a
          href={demoHref}
          className="mt-6 inline-block rounded-full bg-[var(--brand-primary,#5645d4)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Book a demo
        </a>
      </section>
    </ContentShell>
  );
}
