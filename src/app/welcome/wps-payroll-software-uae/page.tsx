import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "../content-shell";
import { CAPABILITIES, FAQS, SITE, demoHref } from "../content";

const TITLE = "WPS Payroll Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Run payroll for hundreds of workers from approved hours, apply overtime, loans and gratuity automatically, and export a bank-ready WPS SIF file every month.";
const URL = "https://manpowersync.com/welcome/wps-payroll-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "WPS payroll software UAE",
    "WPS SIF software",
    "SIF file generator UAE",
    "payroll software Dubai manpower",
    "manpower payroll UAE",
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const PAYROLL_CAPABILITY = CAPABILITIES.find((c) => c.title === "Payroll & WPS")!;
const FAQ_SLICE = FAQS.filter((f) =>
  ["Does payroll produce a WPS file our bank accepts?", "Who can see salary and client data?"].includes(f.q)
);

const DIFFERENTIATORS = [
  {
    title: "A SIF file your bank actually accepts",
    body: "Bank and routing details, labour card numbers and salary figures come straight from the employee record used every month, not re-typed into a fresh spreadsheet each time — the single biggest cause of a rejected file.",
  },
  {
    title: "Overtime, loans and gratuity, calculated the same way every time",
    body: "Payroll runs from approved hours with each employee's pay structure — itemised, flat or hourly — applied consistently, including overtime multipliers, recurring loan deductions and end-of-service gratuity.",
  },
  {
    title: "Approval limits and a four-eyes check before money moves",
    body: "A payroll run above a set threshold can't be approved by the same person who created it, and every figure is written to the audit log — so a payroll error is caught before the transfer, not after.",
  },
];

export default function WpsPayrollSoftwarePage() {
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
          Payroll for a workforce paid monthly, through WPS
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
          <h2 className="text-center text-2xl font-semibold text-slate-900">{PAYROLL_CAPABILITY.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{PAYROLL_CAPABILITY.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {PAYROLL_CAPABILITY.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14 text-center">
        <p className="text-slate-600">
          Payroll runs from hours already approved on the timesheet side — see how{" "}
          <Link href="/welcome/timesheet-software-construction-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            timesheets flow into payroll
          </Link>
          , or read what actually causes a{" "}
          <Link href="/welcome/blog/wps-sif-rejection-reasons-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            WPS SIF file to get rejected
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
        <h2 className="text-2xl font-semibold text-slate-900">Run this month&rsquo;s payroll on {SITE.name}</h2>
        <p className="mt-3 text-slate-600">
          Bring your employees&rsquo; bank details as they stand today — nothing to re-key before your first run.
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
