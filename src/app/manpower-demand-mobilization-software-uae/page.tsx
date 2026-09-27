import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { CAPABILITIES, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "Manpower Demand & Mobilization Tracking Software for UAE";
const DESCRIPTION =
  "Track every client request from enquiry and quotation through mobilisation, site arrival and demobilisation — and know exactly who's deployed where, today.";
const URL = "https://manpowersync.com/manpower-demand-mobilization-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "manpower demand management software",
    "workforce mobilization tracking UAE",
    "manpower deployment software UAE",
    "labour supply demand software",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const PROJECTS_CAPABILITY = CAPABILITIES.find((c) => c.title === "Projects, sites & demand")!;

const DIFFERENTIATORS = [
  {
    title: "From enquiry to quotation to mobilisation, one thread",
    body: "A client's request, the quotation raised against it, and the workers eventually mobilised all stay attached to the same record instead of scattered across emails and separate files.",
  },
  {
    title: "Know exactly who's deployed where, today",
    body: "A worker's current project and site are always on their record — not a spreadsheet someone updates when they remember to.",
  },
  {
    title: "Demobilisation tracked, not just mobilisation",
    body: "The date a worker actually left a site matters as much as when they arrived — both are recorded, so a project's real workforce history is there when a client asks for it.",
  },
];

export default function DemandMobilizationPage() {
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
          Every client request, from first ask to demobilisation
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
          <h2 className="text-center text-2xl font-semibold text-slate-900">{PROJECTS_CAPABILITY.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{PROJECTS_CAPABILITY.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {PROJECTS_CAPABILITY.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14 text-center">
        <p className="text-slate-600">
          Once a worker is mobilised, their hours flow into{" "}
          <Link href="/timesheet-software-construction-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            timesheets
          </Link>{" "}
          and their bed into{" "}
          <Link href="/camp-accommodation-management-software-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            camp accommodation
          </Link>
          .
        </p>
      </section>

      <section className="py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Track your next mobilisation on {SITE.name}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">From the client&rsquo;s first enquiry to the worker&rsquo;s first day on site.</p>
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
