import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { ChipRow, CtaBand, FaqList, PointGrid, Section } from "@/app/welcome/content-blocks";
import { PricingPlans } from "./pricing-plans";
import { SITE } from "@/app/welcome/content";

const TITLE = "Pricing";
const DESCRIPTION = `${SITE.name} plans start at AED 500 a month (AED 5,500 a year) for up to 200 members. Pro is AED 1,000 a month (AED 11,000 a year) for up to 500 members with a dedicated account manager and the supplier portal. Hosting and database are included, and Custom plans are built around your operation.`;
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
  "Staff and employee portals",
  "Role-based permissions & audit log",
  "Hosting & database",
  "Email support",
  "Limited AI credits",
  "Data migration help",
];

const PRICING_FAQS = [
  {
    q: "How is pricing structured?",
    a: "A monthly or annual plan sized by the number of members. Basic is AED 500 a month (AED 5,500 a year) for up to 200 members. Pro is AED 1,000 a month (AED 11,000 a year) for up to 500 members. Beyond that, each additional member is AED 2.5. For anything bigger, the Custom plan is quoted around your operation.",
  },
  {
    q: "Are hosting and database included?",
    a: "Yes, in both Basic and Pro.",
  },
  {
    q: "What does annual billing save?",
    a: "Paying annually is 12 months for the price of 11: AED 5,500 a year on Basic and AED 11,000 a year on Pro.",
  },
  {
    q: "Which plan includes the supplier portal?",
    a: "The supplier portal is part of Pro. The employee portal is on every plan.",
  },
  {
    q: "What support do I get?",
    a: "Email support on both plans: replies within 2 business days on Basic and within 1 business day on Pro. Pro also comes with a dedicated account manager, a kickoff call and a quarterly review call.",
  },
  {
    q: "What are AI credits?",
    a: "One credit is one document read (a passport, Emirates ID, labour card or trade licence) or one assistant question. Basic includes 1,000 credits to start and 300 a month; Pro includes 2,500 to start and 1,000 a month. Monthly credits don't roll over, and the starter credits last 90 days. Extra credits are AED 50 per 1,000.",
  },
  {
    q: "What does getting started involve?",
    a: "Employees and sites are imported from your existing sheets, and your current timesheet workbook can be uploaded as-is. Data migration help is included in both Basic and Pro, so there is nothing to re-key before your first month.",
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

      <Section surface eyebrow="How it adds up" title="Two things make up your price.">
        <PointGrid
          points={[
            {
              icon: "users",
              title: "A plan sized by members",
              body: "Basic covers up to 200 members and Pro up to 500, billed monthly or annually. Beyond that, each additional member is AED 2.5.",
            },
            {
              icon: "dashboard",
              title: "Hosting and database included",
              body: "No separate hosting or database bill on either plan.",
            },
          ]}
        />
      </Section>

      <Section eyebrow="What's included" title="Included in both Basic and Pro.">
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
