import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import p from "@/app/(marketing)/welcome/prose.module.css";
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
      <Section surface>
        <div className={p.prose}>
          <h2>How to choose between Excel, an HR system and a manpower ERP</h2>
          <p>
            Most UAE manpower suppliers start in Excel, and for a handful of workers on one or two sites that is a
            reasonable place to be. The question is not which tool is best in the abstract, but where the work
            outgrows the one you have. These comparisons are written around that question.
          </p>
          <h3>Four questions that decide it</h3>
          <ul>
            <li>
              <strong>Do you bill clients by the hour?</strong> If approved hours become client invoices, billing has to
              come from the same record as payroll, or the two drift apart.
            </li>
            <li>
              <strong>How many workers and sites?</strong> A spreadsheet per site works until the same worker, rate or
              absence has to be reconciled across several of them.
            </li>
            <li>
              <strong>How much compliance are you carrying?</strong> Visas, Emirates IDs, labour cards and the monthly WPS
              file are daily operational work for a supplier, not an annual HR task.
            </li>
            <li>
              <strong>Who else touches the data?</strong> Supervisors, finance, workers and subcontractors each need a
              different view, and a shared workbook gives everyone the same one.
            </li>
          </ul>
          <h3>What each comparison covers</h3>
          <p>
            Every page sets out what the option does well, where it stops, and a side-by-side table so you can check it
            against your own set-up. If you are still deciding what to look for in any system, the{" "}
            <a href="/blog/manpower-supply-software-uae-buyers-checklist">12-question buyer&rsquo;s checklist</a> is a good
            companion, and the <a href="/pricing">pricing page</a> shows what a manpower ERP costs.
          </p>
        </div>
      </Section>
      <CtaBand
        title="Not sure which fits?"
        lead="Bring your current workbook and tell us how you bill clients. We'll say plainly whether you need a system yet."
      />
    </ContentShell>
  );
}
