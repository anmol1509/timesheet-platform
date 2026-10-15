import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { COMPARISONS } from "./compare-data";

const TITLE = "Compare Manpower Software Options (UAE)";
const DESCRIPTION =
  "Honest comparisons for UAE manpower suppliers weighing up Excel, a general HRMS and a manpower ERP: what each does well, where it stops, and how to choose.";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/compare` },
});

export default function CompareIndexPage() {
  return (
    <ContentShell>
      <PageHero eyebrow="Compare" title="How the options stack up." lead={DESCRIPTION} cta={false} />
      <Section eyebrow="Comparisons" title="Pick the one you are weighing.">
        <LinkCardGrid cards={COMPARISONS.map((c) => ({ href: `/compare/${c.slug}`, title: c.label, body: c.description }))} />
      </Section>
      <CtaBand
        title="Not sure which fits?"
        lead="Bring your current workbook and tell us how you bill clients. We'll say plainly whether you need a system yet."
      />
    </ContentShell>
  );
}
