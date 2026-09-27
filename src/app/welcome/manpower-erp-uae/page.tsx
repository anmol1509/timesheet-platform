import type { Metadata } from "next";
import { ContentShell } from "../content-shell";
import { CAPABILITIES, DEEP_DIVES, FAQS, SITE, demoHref } from "../content";

const TITLE = "Manpower ERP for UAE Manpower Suppliers";
const DESCRIPTION =
  "A manpower ERP built for UAE labour supply companies: timesheets, WPS payroll, client billing, visa/Emirates ID compliance, camps and transport in one system.";
const URL = "https://manpowersync.com/welcome/manpower-erp-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "manpower ERP",
    "manpower ERP UAE",
    "manpower ERP software",
    "manpower management software UAE",
    "labour supply ERP Dubai",
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const DIFFERENTIATORS = [
  {
    title: "Built for a workforce you bill by the hour",
    body: "A generic HRMS stops at employee records and internal payroll. A manpower ERP also has to turn approved hours into client invoices, track which client each worker is deployed to, and handle subcontractor crews as first-class citizens — not bolted-on extras.",
  },
  {
    title: "UAE compliance is the day-to-day job, not an add-on",
    body: "Visa, Emirates ID, labour card and passport expiries drive daily operations for a manpower supplier — not a once-a-year HR task. The ERP has to surface what's expiring, for whom, before it becomes a fine.",
  },
  {
    title: "Payroll that produces a WPS file your bank accepts",
    body: "Hundreds of workers, paid monthly, through the Wage Protection System — the ERP needs to get bank details, salary structure and the SIF export right the first time, every month.",
  },
];

const FAQ_SLICE = FAQS.slice(0, 4);

export default function ManpowerErpUaePage() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {TITLE}
        </h1>
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
          Why manpower suppliers need their own ERP, not a general HR system
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
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">
            Everything a manpower ERP needs to cover
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-base font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{c.body}</p>
                <ul className="mt-3 space-y-1">
                  {c.points.map((p) => (
                    <li key={p} className="text-sm text-slate-500">
                      &middot; {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-14">
        <h2 className="text-center text-2xl font-semibold text-slate-900">
          Compliance and operations, covered end to end
        </h2>
        <div className="mt-8 space-y-8">
          {DEEP_DIVES.map((d) => (
            <div key={d.title} className="border-b border-slate-100 pb-8 last:border-0">
              <p className="text-xs font-semibold tracking-wide text-[var(--brand-primary,#5645d4)] uppercase">
                {d.eyebrow}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.body}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {d.points.map((p) => (
                  <li key={p} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
        <h2 className="text-2xl font-semibold text-slate-900">
          See {SITE.name} on your own workforce
        </h2>
        <p className="mt-3 text-slate-600">
          Bring your current timesheet workbook — nothing to re-key before your first month.
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
