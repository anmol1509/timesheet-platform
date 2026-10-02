import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { ChipRow, CtaBand, FaqList, PointGrid, Section } from "@/app/welcome/content-blocks";
import { PricingPlans } from "./pricing-plans";
import { SITE } from "@/app/welcome/content";

const TITLE = "Pricing";
const DESCRIPTION = `${SITE.name} plans start at AED 500 a month for up to 200 members, with a one-time AED 5,000 setup fee. Pro covers up to 500 members with hosting and database included, and Custom plans are built around your operation.`;
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
    a: "A one-time setup fee plus a monthly plan sized by the number of members. Basic is AED 500 a month for up to 200 members, Pro is AED 1,000 a month for up to 500 members, and beyond that each additional member is AED 2.5. For anything bigger, the Custom plan is quoted around your operation.",
  },
  {
    q: "Is there a setup fee?",
    a: "Yes. Basic and Pro each carry a one-time setup fee of AED 5,000.",
  },
  {
    q: "What are hosting and database charges?",
    a: "The cost of running your workspace and keeping its data. On Basic they are billed separately; on Pro they are included in the monthly price.",
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
      <PricingPlans />

      <Section surface eyebrow="How it adds up" title="Three things make up your price.">
        <PointGrid
          points={[
            {
              icon: "check",
              title: "A one-time setup fee",
              body: "AED 5,000 on Basic and Pro, charged once when you start.",
            },
            {
              icon: "users",
              title: "A monthly plan by members",
              body: "Basic covers up to 200 members and Pro up to 500. Beyond that, each additional member is AED 2.5.",
            },
            {
              icon: "dashboard",
              title: "Hosting and database",
              body: "Billed separately on Basic and included in Pro.",
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
        title="Not sure which plan fits?"
        lead="Tell us how many members, how many sites and which portals you need, and we'll point you to the right one."
      />
    </ContentShell>
  );
}
