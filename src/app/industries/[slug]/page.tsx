import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { SITE, demoHref } from "@/app/welcome/content";
import { INDUSTRIES_DATA } from "../industries-data";

export function generateStaticParams() {
  return INDUSTRIES_DATA.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const industry = INDUSTRIES_DATA.find((i) => i.slug === slug);
  if (!industry) return {};
  const url = `https://manpowersync.com/industries/${industry.slug}`;
  return {
    title: industry.title,
    description: industry.description,
    keywords: [...industry.keywords],
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title: industry.title, description: industry.description, url, type: "article" },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = INDUSTRIES_DATA.find((i) => i.slug === slug);
  if (!industry) notFound();

  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <p className="text-xs font-semibold tracking-wide text-[var(--brand-primary,#5645d4)] uppercase">
          For {industry.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{industry.title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{industry.description}</p>
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
        <p className="text-center text-slate-600">{industry.intro}</p>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">
            Built for how {industry.name.toLowerCase()} actually staffs
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {industry.differentiators.map((d) => (
              <div key={d.title}>
                <h3 className="text-base font-semibold text-slate-900">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14 text-center">
        <p className="text-slate-600">
          See the full{" "}
          <Link href="/manpower-erp-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            manpower ERP
          </Link>{" "}
          this runs on, including{" "}
          <Link href="/wps-payroll-software-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            WPS payroll
          </Link>{" "}
          and{" "}
          <Link href="/timesheet-software-construction-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            timesheets
          </Link>
          .
        </p>
      </section>

      <section className="py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">See {SITE.name} built for {industry.name.toLowerCase()}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">Bring your current workforce sheet — nothing to re-key before your first month.</p>
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
