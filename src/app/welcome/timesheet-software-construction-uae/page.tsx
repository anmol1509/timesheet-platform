import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "../content-shell";
import { CAPABILITIES, FAQS, STEPS, SITE, demoHref } from "../content";

const TITLE = "Timesheet Software for Construction & Manpower Teams in the UAE";
const DESCRIPTION =
  "Bring in hours from Excel workbooks, manual entry or supplier submissions, apply overtime and rest-day rules automatically, and send approved hours straight to invoices and payroll.";
const URL = "https://manpowersync.com/welcome/timesheet-software-construction-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "timesheet software construction UAE",
    "construction timesheet software Dubai",
    "manpower timesheet app UAE",
    "attendance software construction UAE",
    "client timesheet software UAE",
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const TIMESHEET_CAPABILITY = CAPABILITIES.find((c) => c.title === "Timesheets & attendance")!;
const FAQ_SLICE = FAQS.filter((f) =>
  ["Can we bring our existing Excel timesheets?", "How is this different from a general HRMS or ERP?"].includes(f.q)
);

const DIFFERENTIATORS = [
  {
    title: "Hours arrive however your sites actually work",
    body: "The same consolidated Excel workbook your sites already send in, entered manually for a site with no system, or submitted by a subcontractor through their own portal — one system reconciles all three.",
  },
  {
    title: "Overtime and rest-day rules applied automatically",
    body: "Exceptions and overtime are flagged as hours come in, not worked out by hand at month end. Supervisors sign off in one approval queue instead of chasing a dozen separate sheets.",
  },
  {
    title: "Approved hours flow straight to invoices and payroll",
    body: "The same approved hours become client invoices and payroll input — nothing gets re-typed between the team that tracks attendance and the teams that bill and pay.",
  },
];

export default function TimesheetSoftwarePage() {
  return (
    <ContentShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_SLICE.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

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
          One system for hours, however they come in
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
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">From hours to paid, in three steps</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <span className="text-sm font-semibold text-[var(--brand-primary,#5645d4)]">{step.n}</span>
                <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="text-center text-2xl font-semibold text-slate-900">{TIMESHEET_CAPABILITY.title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{TIMESHEET_CAPABILITY.body}</p>
        <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
          {TIMESHEET_CAPABILITY.points.map((p) => (
            <li key={p} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-slate-600">
          Once hours are approved here, see how they turn into a bank-ready{" "}
          <Link href="/welcome/wps-payroll-software-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            WPS payroll run
          </Link>
          .
        </p>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">Common questions</h2>
          <div className="mt-8 space-y-6">
            {FAQ_SLICE.map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-semibold text-slate-900">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Bring this month&rsquo;s timesheets to {SITE.name}</h2>
        <p className="mt-3 text-slate-600">
          Upload your current workbook as-is — every month tab is detected and reconciled automatically.
        </p>
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
