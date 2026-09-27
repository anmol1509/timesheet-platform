import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { DEEP_DIVES, FAQS, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "AI Assistant for Workforce & Compliance Data (UAE)";
const DESCRIPTION =
  "Ask your workforce data a plain-language question and get an answer with a link to the record it came from — permission-aware, so nobody sees more than their role already allows.";
const URL = "https://manpowersync.com/ai-assistant-workforce-management";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI assistant manpower software",
    "AI ERP assistant UAE",
    "workforce AI assistant construction",
    "AI document extraction UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const ASSISTANT_DEEP_DIVE = DEEP_DIVES.find((d) => d.eyebrow === "Built-in assistant")!;
const DOCUMENTS_DEEP_DIVE = DEEP_DIVES.find((d) => d.eyebrow === "Documents & compliance")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "Who can see salary and client data?");

const DIFFERENTIATORS = [
  {
    title: "Ask in plain language, get an answer from live data",
    body: "“Which visas expire this month?” “How many welders are on Site 14?” — questions like these are answered directly from your current records, not a canned report you have to go find.",
  },
  {
    title: "Permission-aware, every time",
    body: "The assistant answers within whatever a user is already allowed to see — it can never surface salary, another branch's data, or anything outside their role, no matter how the question is phrased.",
  },
  {
    title: "Every answer links back to the record",
    body: "An answer isn't a dead end — it links straight to the employee, project or document it came from, so the next step (renew a visa, check a timesheet) is one click away.",
  },
];

export default function AiAssistantPage() {
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
        <h2 className="text-center text-2xl font-semibold text-slate-900">AI built into the system you already use</h2>
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
          <p className="text-center text-xs font-semibold tracking-wide text-[var(--brand-primary,#5645d4)] uppercase">
            {ASSISTANT_DEEP_DIVE.eyebrow}
          </p>
          <h2 className="mt-1 text-center text-2xl font-semibold text-slate-900">{ASSISTANT_DEEP_DIVE.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{ASSISTANT_DEEP_DIVE.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {ASSISTANT_DEEP_DIVE.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-center text-xs font-semibold tracking-wide text-[var(--brand-primary,#5645d4)] uppercase">
          {DOCUMENTS_DEEP_DIVE.eyebrow}
        </p>
        <h2 className="mt-1 text-center text-2xl font-semibold text-slate-900">{DOCUMENTS_DEEP_DIVE.title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{DOCUMENTS_DEEP_DIVE.body}</p>
        <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
          {DOCUMENTS_DEEP_DIVE.points.map((p) => (
            <li key={p} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {p}
            </li>
          ))}
        </ul>
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
        <h2 className="text-2xl font-semibold text-slate-900">See the assistant on your own workforce data</h2>
        <p className="mt-3 text-slate-600">
          It&rsquo;s built into {SITE.name} from day one — see the full{" "}
          <Link href="/manpower-erp-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            manpower ERP
          </Link>
          .
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
