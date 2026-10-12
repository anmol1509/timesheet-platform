import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { ChipRow, CtaBand, LinkCardGrid, PageHero, Section, StatsRow, TintCardGrid } from "@/app/welcome/content-blocks";
import { CAPABILITIES, DEEP_DIVES, FACTS, PORTALS, SITE } from "@/app/welcome/content";

const TITLE = "Features";
const DESCRIPTION = `Everything ${SITE.name} covers for a UAE manpower supplier, in one place: timesheets, payroll, billing, projects, compliance, camps and the built-in assistant.`;
const URL = "https://manpowersync.com/features";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["manpower software features UAE", "workforce management software features", "manpower ERP features"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function FeaturesPage() {
  return (
    <ContentShell>
      <PageHero
        eyebrow="Features"
        title="More than 30 modules. One login."
        lead={DESCRIPTION}
        note="Permissions decide who sees what, down to the module and action"
      />

      <Section flush>
        <StatsRow facts={FACTS} />
      </Section>

      <Section surface eyebrow="Core modules" title="The four that run the business.">
        <TintCardGrid cards={CAPABILITIES} />
      </Section>

      <Section eyebrow="Three portals" title="Everyone who touches the work, on the same page.">
        <TintCardGrid
          columns={3}
          cards={PORTALS.map((p) => ({
            tint: p.tint,
            icon: p.title === "Supplier portal" ? ("users" as const) : p.title === "Employee self-service" ? ("phone" as const) : ("dashboard" as const),
            title: p.title,
            body: p.body,
            points: p.points,
          }))}
        />
      </Section>

      {DEEP_DIVES.map((d, i) => (
        <Section key={d.eyebrow} surface={i % 2 === 0} eyebrow={d.eyebrow} title={d.title} lead={d.body}>
          <ChipRow items={d.points} />
        </Section>
      ))}

      <Section eyebrow="Go deeper" title="Each part, in detail.">
        <LinkCardGrid
          columns={3}
          cards={[
            { href: "/solutions", title: "All solutions", body: "Nine pages, one per part of the platform — timesheets through to the AI assistant." },
            { href: "/industries", title: "By industry", body: "How it fits construction, MEP, FM, cleaning & hospitality, oil & gas and security." },
            { href: "/guides", title: "Guides", body: "Step-by-step help with importing your workforce, running payroll and setting up roles." },
          ]}
        />
      </Section>

      <CtaBand
        title="See every module on your own data."
        lead="Bring your current timesheet workbook — nothing to re-key before your first month."
      />
    </ContentShell>
  );
}
