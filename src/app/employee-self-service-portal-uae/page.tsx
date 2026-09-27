import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { PORTALS, FAQS, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "Employee Self-Service Portal for UAE Manpower Suppliers";
const DESCRIPTION =
  "Workers check their attendance, download payslips and view their own documents from any phone browser — no app to install, no call to HR needed.";
const URL = "https://manpowersync.com/employee-self-service-portal-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "employee self service portal UAE",
    "worker payslip app UAE",
    "employee portal manpower software",
    "construction worker attendance app UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const EMPLOYEE_PORTAL = PORTALS.find((p) => p.title === "Employee self-service")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "Do workers need to install an app?");

const DIFFERENTIATORS = [
  {
    title: "Runs in any phone browser — nothing to install",
    body: "No app store, no download, no minimum phone spec. A worker opens a link, signs in, and sees their own record.",
  },
  {
    title: "Payslips and attendance without a call to HR",
    body: "“What did I get paid this month?” and “how many days did I work?” stop being questions that need a phone call — a worker can check both themselves, whenever they want.",
  },
  {
    title: "Their own documents, in one place",
    body: "Passport, visa, Emirates ID and labour card details a worker is entitled to see are available to them directly, instead of scattered across paper copies.",
  },
];

export default function EmployeeSelfServicePage() {
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
        <h2 className="text-center text-2xl font-semibold text-slate-900">A portal your workforce will actually use</h2>
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
          <h2 className="text-center text-2xl font-semibold text-slate-900">{EMPLOYEE_PORTAL.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{EMPLOYEE_PORTAL.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {EMPLOYEE_PORTAL.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 text-center">
        <p className="text-slate-600">
          The employee portal is one of three portals in {SITE.name} — alongside the{" "}
          <Link href="/supplier-portal-software-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            supplier portal
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
        <h2 className="text-2xl font-semibold text-slate-900">Give your workforce their own portal</h2>
        <p className="mt-3 text-slate-600">Workers can sign in and see their first payslip the same day it&rsquo;s run.</p>
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
