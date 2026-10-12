import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section, StatsRow } from "@/app/welcome/content-blocks";
import { FACTS, SITE } from "@/app/welcome/content";
import { SOLUTIONS_DATA } from "./solutions-data";

const TITLE = "Solutions";
const DESCRIPTION = `Every part of ${SITE.name}, one page each — timesheets, payroll, billing, mobilisation, camps, portals and the built-in assistant.`;
const URL = "https://manpowersync.com/solutions";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function SolutionsIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Solutions" title="One platform, explored piece by piece." lead={DESCRIPTION} />

      <Section eyebrow="The platform" title="Nine parts, one set of records.">
        <LinkCardGrid
          cards={SOLUTIONS_DATA.map((s) => ({
            href: `/${s.slug}`,
            title: s.label,
            body: s.description,
          }))}
        />
      </Section>

      <Section surface flush={false}>
        <StatsRow facts={FACTS} />
      </Section>

      <Section eyebrow="By industry" title="Or start from your industry instead.">
        <LinkCardGrid
          columns={3}
          cards={[
            {
              href: "/industries",
              title: "Browse industries",
              body: "Construction, MEP, facilities management, cleaning & hospitality, oil & gas and security services.",
            },
            {
              href: "/features",
              title: "All features",
              body: "The full module list in one place, from timesheets through to letters, NOCs and the audit trail.",
            },
            {
              href: "/pricing",
              title: "Pricing",
              body: "How pricing works, what's included, and how to get a quote for your own workforce.",
            },
          ]}
        />
      </Section>

      <CtaBand
        title="See the whole thing running."
        lead="A 30-minute call with your own timesheet workbook is all it takes."
      />
    </ContentShell>
  );
}
