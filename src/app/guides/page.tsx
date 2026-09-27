import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { SITE } from "@/app/welcome/content";
import { GUIDES } from "./guides-data";

const TITLE = "Guides";
const DESCRIPTION = `Step-by-step guides to running ${SITE.name} — importing your workforce, running payroll, and setting up your team.`;
const URL = "https://manpowersync.com/guides";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function GuidesIndexPage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Guides</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{DESCRIPTION}</p>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16">
        <ul className="space-y-8">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="border-b border-slate-100 pb-8 last:border-0">
              <h2 className="text-xl font-semibold text-slate-900">
                <Link href={`/guides/${guide.slug}`} className="hover:underline">
                  {guide.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{guide.description}</p>
              <Link
                href={`/guides/${guide.slug}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--brand-primary,#5645d4)] hover:underline"
              >
                Read more &rarr;
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ContentShell>
  );
}
