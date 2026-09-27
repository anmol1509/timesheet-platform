import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { SITE, demoHref } from "@/app/welcome/content";

const TITLE = "Pricing";
const DESCRIPTION = `${SITE.name} is priced around your workforce size and the modules you need — talk to us for a quote built around your operation.`;
const URL = "https://manpowersync.com/pricing";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

const INCLUDED = [
  "Timesheets & attendance",
  "Payroll & WPS",
  "Billing & finance",
  "Projects, sites & demand",
  "Documents & compliance",
  "Camps & transport",
  "Staff, employee and supplier portals",
  "Role-based permissions & audit log",
];

export default function PricingPage() {
  return (
    <ContentShell>
      <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Pricing</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">{DESCRIPTION}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={demoHref}
            className="rounded-full bg-[var(--brand-primary,#5645d4)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Book a demo
          </a>
          <a
            href={`mailto:${SITE.salesEmail}`}
            className="rounded-full border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 hover:border-slate-300"
          >
            Contact sales
          </a>
        </div>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">Why we don&rsquo;t list numbers here</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
            A supplier running 40 workers and one running 2,000 aren&rsquo;t the same deployment, and
            a flat price would either overcharge one or undercharge the other. We&rsquo;d rather ask
            what you actually need and quote for that, than publish a number that&rsquo;s wrong for
            most people who read it.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <h2 className="text-center text-2xl font-semibold text-slate-900">Every plan includes the full platform</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          There&rsquo;s no cut-down tier missing the module you actually need — pricing scales with
          your workforce size, not with which parts of the system you&rsquo;re allowed to use.
        </p>
        <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
          {INCLUDED.map((item) => (
            <li key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-2xl px-5">
          <h2 className="text-center text-2xl font-semibold text-slate-900">Common questions</h2>
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">How is pricing structured?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Around the size of your workforce and which portals you need active — talk to us and
                we&rsquo;ll put together a quote for your operation specifically.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Is there a setup fee?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Onboarding — importing your employees and current timesheet workbook — is part of the
                conversation when we quote, not a hidden line item afterward.
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Can we start small and add portals later?</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Yes — the supplier and employee portals can be switched on when you&rsquo;re ready for
                them, rather than needing to commit to everything on day one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Get a quote for your workforce</h2>
        <p className="mt-3 text-slate-600">
          See the full{" "}
          <Link href="/manpower-erp-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            manpower ERP
          </Link>{" "}
          first, or go straight to a demo.
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
