import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { CAPABILITIES, DEEP_DIVES, FACTS, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "Features";
const DESCRIPTION = `Everything ${SITE.name} covers for a UAE manpower supplier, in one place: timesheets, payroll, billing, projects, compliance, camps and the built-in assistant.`;
const URL = "https://manpowersync.com/features";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["manpower software features UAE", "workforce management software features", "manpower ERP features"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function FeaturesPage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Features</h1>
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

      <section className="mx-auto max-w-3xl px-5 pb-10">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.label} className="text-center">
              <p className="text-2xl font-semibold text-slate-900">{f.value}</p>
              <p className="mt-1 text-xs text-slate-500">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">Core modules</h2>
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
        <h2 className="text-center text-2xl font-semibold text-slate-900">Beyond the core modules</h2>
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

      <section className="bg-slate-50 py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">See every module for your own workforce</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          Browse each feature in depth on the{" "}
          <Link href="/solutions" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            solutions
          </Link>{" "}
          page, or jump straight to a demo.
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
