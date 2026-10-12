import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { CtaBand, FaqList, LinkCardGrid, PageHero, Section } from "@/app/welcome/content-blocks";
import { FAQS, SITE } from "@/app/welcome/content";

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
      <PageHero eyebrow="FAQ" title="Questions, answered." lead={DESCRIPTION} />

      <Section>
        <FaqList items={FAQS} />
      </Section>

      <Section surface eyebrow="Still looking" title="Try these instead.">
        <LinkCardGrid
          columns={3}
          cards={[
            { href: "/guides", title: "Guides", body: "Step-by-step help importing your workforce, running payroll and setting up roles and permissions." },
            { href: "/blog", title: "Blog", body: "UAE payroll and compliance reading — WPS rejections, gratuity, overtime rules and expiry tracking." },
            { href: "/pricing", title: "Pricing", body: "How pricing works, what's included, and how to get a quote for your own workforce." },
          ]}
        />
      </Section>

      <CtaBand
        title="Still have a question?"
        lead="A 30-minute call answers more than a page of FAQs ever will."
      />
    </ContentShell>
  );
}
