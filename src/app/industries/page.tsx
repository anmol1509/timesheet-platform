import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { SITE } from "@/app/welcome/content";
import { INDUSTRIES_DATA } from "./industries-data";

const TITLE = "Industries";
const DESCRIPTION = `How ${SITE.name} fits the way each kind of manpower and workforce business actually staffs and bills.`;
const URL = "https://manpowersync.com/industries";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function IndustriesIndexPage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Industries</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{DESCRIPTION}</p>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {INDUSTRIES_DATA.map((industry) => (
            <Link
              key={industry.slug}
              href={`/industries/${industry.slug}`}
              className="rounded-2xl border border-slate-200 p-6 transition-colors hover:border-[var(--brand-primary,#5645d4)]"
            >
              <h2 className="text-base font-semibold text-slate-900">{industry.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{industry.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-[var(--brand-primary,#5645d4)]">
                Learn more &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </ContentShell>
  );
}
