import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { ChipRow, CtaBand, FaqList, PageHero, PointGrid, Section } from "@/app/welcome/content-blocks";
import { SITE } from "@/app/welcome/content";

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

const PRICING_FAQS = [
  {
    q: "How is pricing structured?",
    a: "Around the size of your workforce and which portals you need active — talk to us and we'll put together a quote for your operation specifically.",
  },
  {
    q: "Is there a setup fee?",
    a: "Onboarding — importing your employees and current timesheet workbook — is part of the conversation when we quote, not a hidden line item afterward.",
  },
  {
    q: "Can we start small and add portals later?",
    a: "Yes. The supplier and employee portals can be switched on when you're ready for them, rather than needing to commit to everything on day one.",
  },
  {
    q: "What does getting started involve?",
    a: "Employees and sites are imported from your existing sheets, and your current timesheet workbook can be uploaded as-is. There is nothing to re-key before your first month.",
  },
];

export default function PricingPage() {
  return (
    <ContentShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: PRICING_FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <PageHero
        eyebrow="Pricing"
        title="Priced around your workforce, not a tier list."
        lead={DESCRIPTION}
        note="Every plan includes the full platform — no cut-down tier"
      />

      <Section
        surface
        eyebrow="Straight answer"
        title="Why we don't list numbers here."
        lead="A supplier running 40 workers and one running 2,000 aren't the same deployment, and a flat price would either overcharge one or undercharge the other. We'd rather ask what you actually need and quote for that."
      >
        <PointGrid
          points={[
            {
              icon: "users",
              title: "Scales with your workforce",
              body: "Pricing follows how many workers you're actually running, so a growing roster doesn't mean renegotiating from scratch.",
            },
            {
              icon: "dashboard",
              title: "Not with which features you're allowed",
              body: "There's no cut-down tier missing the module you actually need — every plan includes the full platform.",
            },
            {
              icon: "check",
              title: "Onboarding included in the quote",
              body: "Importing your employees and your current timesheet workbook is part of what we quote, not a surprise line item afterwards.",
            },
          ]}
        />
      </Section>

      <Section eyebrow="What's included" title="Every plan includes the full platform.">
        <ChipRow items={INCLUDED} />
      </Section>

      <Section surface eyebrow="FAQ" title="Pricing questions.">
        <FaqList items={PRICING_FAQS} />
      </Section>

      <CtaBand
        title="Get a quote for your workforce."
        lead="Tell us how many workers, how many sites and which portals you need — we'll come back with a number."
      />
    </ContentShell>
  );
}
