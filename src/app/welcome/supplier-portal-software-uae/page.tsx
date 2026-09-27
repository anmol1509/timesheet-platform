import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "../content-shell";
import { PORTALS, FAQS, SITE, demoHref } from "../content";

const TITLE = "Subcontractor & Supplier Portal Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Give subcontractors their own portal to receive demands, submit workers and timesheets, and track their payments — without another forwarded spreadsheet or follow-up call.";
const URL = "https://manpowersync.com/welcome/supplier-portal-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "subcontractor management software UAE",
    "supplier portal software UAE",
    "manpower subcontractor tracking software",
    "vendor management construction UAE",
    "subcontractor timesheet portal",
  ],
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const SUPPLIER_PORTAL = PORTALS.find((p) => p.title === "Supplier portal")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "How do subcontractors fit in?");

const DIFFERENTIATORS = [
  {
    title: "Subcontractors submit workers and timesheets themselves",
    body: "Instead of a spreadsheet emailed back and forth, a subcontractor logs into their own portal to submit the crew and hours against a demand — the same record your own team approves from.",
  },
  {
    title: "A demand, its quote and its workers, in one thread",
    body: "A request for a trade goes out, the subcontractor quotes and proposes workers against it, and the whole exchange stays attached to that one demand instead of scattered across emails.",
  },
  {
    title: "Payment status they can check themselves",
    body: "A subcontractor can see what's been approved and what's been paid without a phone call to your finance team — fewer \"any update on our payment?\" messages for everyone.",
  },
];

export default function SupplierPortalPage() {
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
          Subcontractor crews, off email and into one system
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
          <h2 className="text-center text-2xl font-semibold text-slate-900">{SUPPLIER_PORTAL.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{SUPPLIER_PORTAL.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {SUPPLIER_PORTAL.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 text-center">
        <p className="text-slate-600">
          The supplier portal is one of three portals in {SITE.name} — see the full{" "}
          <Link href="/welcome/manpower-erp-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            manpower ERP
          </Link>
          .
        </p>
      </section>

      {FAQ_SLICE.length > 0 && (
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
      )}

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Bring your subcontractors onto {SITE.name}</h2>
        <p className="mt-3 text-slate-600">Invite a supplier and they can submit their first crew the same day.</p>
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
