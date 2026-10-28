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
  /** For a translated page: the language code, and the section headings in that language. Right-to-left languages get dir="rtl". */
  locale?: { lang: string; rtl?: boolean; how: [string, string]; faq: [string, string]; more: [string, string]; cta: { title: string; lead: string; label: string }; moreCards: { href: string; title: string; body: string }[] };
};

/** Shared layout for the free tools: compact hero, the tool, how it works, the article, a next step, FAQ. */
export function ToolPage({ slug, accent, hero, ld, tool, how, article, next, faqs, locale }: Props) {
  const more = locale?.moreCards ?? TOOLS.filter((t) => t.slug !== slug).map((t) => ({ href: `/tools/${t.slug}`, title: t.label, body: t.description }));
  return (
    <ContentShell>
      <JsonLd data={ld} />
      <ShowcaseRoot accent={accent}>
        <div lang={locale?.lang} dir={locale?.rtl ? "rtl" : undefined}>
        <ToolHero {...hero} />
        <ToolStage>{tool}</ToolStage>

        <Band>
          <SectionHead eyebrow={locale?.how[0] ?? "How it works"} title={locale?.how[1] ?? "Three steps, no sign-up."} />
          <HowStrip steps={how} />
        </Band>

        <Band soft>
          <div className={`${p.prose}`}>{article}</div>
        </Band>

        <Band>
          <NextStep {...next} />
        </Band>

        <Band soft>
          <SectionHead eyebrow={locale?.faq[0] ?? "FAQ"} title={locale?.faq[1] ?? "Questions, answered."} />
          <Faq items={faqs} />
        </Band>

        <Band>
          <SectionHead eyebrow={locale?.more[0] ?? "More free tools"} title={locale?.more[1] ?? "Other tools you may need."} />
          <LinkCards cards={more} />
        </Band>

        <ShowcaseCta
          title={locale?.cta.title ?? "See ManpowerSync on your own workforce."}
          lead={locale?.cta.lead ?? "Payroll, timesheets, billing and compliance on one set of records. Bring your current files; nothing to re-key."}
          label={locale?.cta.label}
        />
        </div>
      </ShowcaseRoot>
    </ContentShell>
  );
}
