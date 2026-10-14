import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "./tools-data";

const TITLE = "Free UAE Payroll & Manpower Tools";
const DESCRIPTION =
  "Free calculators for UAE manpower suppliers: end-of-service gratuity and the hourly rate to charge for labour supply. No sign-up, and nothing you type leaves your browser.";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tools` },
});

export default function ToolsIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Free tools" title="Calculators for UAE manpower suppliers." lead={DESCRIPTION} cta={false} />
      <Section eyebrow="Calculators" title="Free, and private.">
        <LinkCardGrid
          cards={TOOLS.map((t) => ({ href: `/tools/${t.slug}`, title: t.label, body: t.description }))}
        />
      </Section>
      <CtaBand
        title="Run payroll, gratuity and billing from one system."
        lead="The same rules these calculators use are built into ManpowerSync's payroll and invoicing."
      />
    </ContentShell>
  );
}
