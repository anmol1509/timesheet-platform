import type { ReactNode } from "react";
import { JsonLd } from "@/lib/seo/jsonld";
import p from "@/app/(marketing)/welcome/prose.module.css";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import {
  type Accent,
  Band,
  Faq,
  HowStrip,
  LinkCards,
  NextStep,
  SectionHead,
  ShowcaseCta,
  ShowcaseRoot,
  ToolHero,
  ToolStage,
} from "@/app/(marketing)/welcome/showcase/showcase";
import { TOOLS } from "./tools-data";

type Props = {
  /** The tool's slug, so it is left out of its own "more free tools" row. */
  slug: string;
  accent: Accent;
  hero: { pill: string; pillIcon: ReactNode; title: ReactNode; lead: string; badges: string[] };
  /** Structured data for the page (WebApplication and FAQ). */
  ld: Parameters<typeof JsonLd>[0]["data"];
  /** The interactive tool. */
  tool: ReactNode;
  how: { title: string; body: string }[];
  /** The explanatory article under the tool; the FAQ is rendered separately. */
  article: ReactNode;
  next: { title: string; body: string; href: string; label: string };
  faqs: readonly { q: string; a: string }[];
};

/** Shared layout for the free tools: compact hero, the tool, how it works, the article, a next step, FAQ. */
export function ToolPage({ slug, accent, hero, ld, tool, how, article, next, faqs }: Props) {
  const more = TOOLS.filter((t) => t.slug !== slug).map((t) => ({ href: `/tools/${t.slug}`, title: t.label, body: t.description }));
  return (
    <ContentShell>
      <JsonLd data={ld} />
      <ShowcaseRoot accent={accent}>
        <ToolHero {...hero} />
        <ToolStage>{tool}</ToolStage>

        <Band>
          <SectionHead eyebrow="How it works" title="Three steps, no sign-up." />
          <HowStrip steps={how} />
        </Band>

        <Band soft>
          <div className={`${p.prose}`}>{article}</div>
        </Band>

        <Band>
          <NextStep {...next} />
        </Band>

        <Band soft>
          <SectionHead eyebrow="FAQ" title="Questions, answered." />
          <Faq items={faqs} />
        </Band>

        <Band>
          <SectionHead eyebrow="More free tools" title="Other tools you may need." />
          <LinkCards cards={more} />
        </Band>

        <ShowcaseCta title="See ManpowerSync on your own workforce." lead="Payroll, timesheets, billing and compliance on one set of records. Bring your current files; nothing to re-key." />
      </ShowcaseRoot>
    </ContentShell>
  );
}
