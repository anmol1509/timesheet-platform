import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/welcome/content-blocks";
import { SITE } from "@/app/welcome/content";
import { GUIDES } from "./guides-data";

const TITLE = "Guides";
const DESCRIPTION = `Step-by-step guides to running ${SITE.name} — importing your workforce, running payroll, and setting up your team.`;
const URL = "https://manpowersync.com/guides";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function GuidesIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Guides" title="How to run it, step by step." lead={DESCRIPTION} />

      <Section eyebrow="Getting started" title="Start here.">
        <LinkCardGrid
          cards={GUIDES.map((g) => ({
            href: `/guides/${g.slug}`,
            title: g.title,
            body: g.description,
          }))}
        />
      </Section>

      <Section surface eyebrow="Also useful" title="Reading, rather than how-to.">
        <LinkCardGrid
          columns={3}
          cards={[
            { href: "/blog", title: "Blog", body: "UAE payroll and compliance reading — WPS rejections, gratuity, overtime rules and expiry tracking." },
            { href: "/faq", title: "FAQ", body: "The short answers: getting started, timesheets, payroll and WPS, security, subcontractors." },
            { href: "/features", title: "Features", body: "Every module in one place, from timesheets through to letters, NOCs and the audit trail." },
          ]}
        />
      </Section>

      <CtaBand
        title="Rather be walked through it?"
        lead="A 30-minute call with your own timesheet workbook beats any guide."
      />
    </ContentShell>
  );
}
