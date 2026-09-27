import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { FAQS, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "Frequently Asked Questions";
const DESCRIPTION = `Common questions about ${SITE.name} — getting started, timesheets, payroll and WPS, security, and how subcontractors fit in.`;
const URL = "https://manpowersync.com/faq";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function FaqPage() {
  return (
    <ContentShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
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
      </section>

      <section className="mx-auto max-w-2xl px-5 pb-16">
        <div className="space-y-8">
          {FAQS.map((f) => (
            <div key={f.q} className="border-b border-slate-100 pb-8 last:border-0">
              <h2 className="text-base font-semibold text-slate-900">{f.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Still have a question?</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          See the{" "}
          <Link href="/guides" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            guides
          </Link>{" "}
          for step-by-step help, or talk to us directly.
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
