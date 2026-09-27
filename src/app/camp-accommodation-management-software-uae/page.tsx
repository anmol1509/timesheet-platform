import type { Metadata } from "next";
import Link from "next/link";
import { ContentShell } from "@/app/welcome/content-shell";
import { DEEP_DIVES, FAQS, SITE, demoHref } from "@/app/welcome/content";

const TITLE = "Camp & Accommodation Management Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Manage labour camps room by room with live occupancy, check workers in and out, and plan transport routes and vehicles against the sites your crews are working at today.";
const URL = "https://manpowersync.com/camp-accommodation-management-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "camp and accommodation management software UAE",
    "labour camp management software",
    "worker accommodation software UAE",
    "transport and camp management construction",
    "bed occupancy software UAE",
  ],
  alternates: { canonical: URL },
  // These are root-level pages now, outside welcome/layout.tsx, so they no
  // longer inherit its robots: { index: true } — the root layout defaults
  // every other page to noindex, so this has to be explicit here.
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const ACCOMMODATION_DEEP_DIVE = DEEP_DIVES.find((d) => d.eyebrow === "Accommodation & transport")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "How is this different from a general HRMS or ERP?");

const DIFFERENTIATORS = [
  {
    title: "Know who sleeps where, room by room",
    body: "Camps are managed bed by bed, not as a headcount against a building. Assigning, moving or freeing a bed updates occupancy immediately, so a camp manager always knows exactly what's free tonight.",
  },
  {
    title: "Check-in and check-out history, not just a snapshot",
    body: "Every move in and out of a room is recorded against the worker and the bed, so a dispute over who was where on a given night has an answer — not a guess.",
  },
  {
    title: "Transport planned against where crews actually work",
    body: "Routes and vehicles are planned against the sites your workforce is deployed to today, not a fixed schedule that stops matching reality the moment a crew moves sites.",
  },
];

export default function CampAccommodationPage() {
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
        <h2 className="text-center text-2xl font-semibold text-slate-900">
          A workforce spread across camps and sites, in one view
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
          <p className="text-center text-xs font-semibold tracking-wide text-[var(--brand-primary,#5645d4)] uppercase">
            {ACCOMMODATION_DEEP_DIVE.eyebrow}
          </p>
          <h2 className="mt-1 text-center text-2xl font-semibold text-slate-900">{ACCOMMODATION_DEEP_DIVE.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">{ACCOMMODATION_DEEP_DIVE.body}</p>
          <ul className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
            {ACCOMMODATION_DEEP_DIVE.points.map((p) => (
              <li key={p} className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10 text-center">
        <p className="text-slate-600">
          Camps and transport sit alongside the rest of the workforce record — see the full{" "}
          <Link href="/manpower-erp-uae" className="font-medium text-[var(--brand-primary,#5645d4)] hover:underline">
            manpower ERP
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
        <h2 className="text-2xl font-semibold text-slate-900">See your camps and routes on {SITE.name}</h2>
        <p className="mt-3 text-slate-600">Bring your current camp and bed list — nothing to re-key before your first month.</p>
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
