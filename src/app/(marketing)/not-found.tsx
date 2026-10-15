import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";

// Rendered (with a 404 status) when a marketing page calls notFound(), e.g. an
// unknown /blog or /industries slug. Unknown top-level URLs get global-not-found.tsx.
export default function MarketingNotFound() {
  return (
    <ContentShell>
      <PageHero eyebrow="404" title="That page doesn't exist." lead="The link may be out of date, or the page has moved. These are good places to start." cta={false} />
      <Section>
        <LinkCardGrid
          columns={3}
          cards={[
            { href: "/solutions", title: "Solutions", body: "Timesheets, WPS payroll, billing, camps and portals, one page each." },
            { href: "/blog", title: "Blog", body: "UAE payroll, WPS and compliance reading." },
            { href: "/pricing", title: "Pricing", body: "Plans from AED 500 a month." },
          ]}
        />
      </Section>
      <CtaBand title="Looking for something specific?" lead="Tell us what you need and we'll point you to it." />
    </ContentShell>
  );
}
