import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { SITE } from "@/app/welcome/content";
import { SOLUTIONS_DATA } from "./solutions-data";

const TITLE = "Solutions";
const DESCRIPTION = `Every part of ${SITE.name}, one page each — timesheets, payroll, billing, mobilisation, camps, portals and the built-in assistant.`;
const URL = "https://manpowersync.com/solutions";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function SolutionsIndexPage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Solutions</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{DESCRIPTION}</p>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-10">
        <div className="grid gap-6 sm:grid-cols-2">
          {SOLUTIONS_DATA.map((solution) => (
            <Link
              key={solution.slug}
              href={`/${solution.slug}`}
              className="rounded-2xl border border-slate-200 p-6 transition-colors hover:border-[var(--brand-primary,#5645d4)]"
            >
              <h2 className="text-base font-semibold text-slate-900">{solution.label}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{solution.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-[var(--brand-primary,#5645d4)]">
                Learn more &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16 text-center">
        <p className="text-slate-600">
          Looking for a specific industry instead?{" "}
          <Link href="/industries" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            Browse by industry
          </Link>
          .
        </p>
      </section>
    </ContentShell>
  );
}
