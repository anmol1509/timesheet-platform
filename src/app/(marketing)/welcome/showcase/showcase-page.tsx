import type { ReactNode } from "react";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { ContentShell } from "../content-shell";
import {
  type Accent,
  Band,
  BeforeAfter,
  Bento,
  Faq,
  LinkCards,
  Peek,
  ProofStrip,
  SectionHead,
  ShowcaseCta,
  ShowcaseHero,
  ShowcaseRoot,
  Step,
  Steps,
  Tile,
  tileParts as T,
} from "./showcase";

export type Shot = { src: string; width: number; height: number; alt: string };

/** Builds a screenshot reference from a file in /public/brand-assets (single level, which the host proxy allows). */
export const shot = (file: string, width: number, height: number, alt: string): Shot => ({ src: `/brand-assets/${file}`, width, height, alt });

export type TileData = {
  icon: ReactNode;
  title: string;
  body: string;
  tone?: "dark" | "tint" | "violet" | "sky";
  span2?: boolean;
  row2?: boolean;
  list?: string[];
  chips?: string[];
  image?: Shot & { fade?: boolean };
  zoom?: Shot;
  log?: { what: string; who: string }[];
};

export type ShowcaseData = {
  accent: Accent;
  hero: {
    pill: string;
    pillIcon: ReactNode;
    title: ReactNode;
    lead: string;
    ticks: string[];
    secondaryCta: { href: string; label: string };
    image: Shot;
    badge: { icon: ReactNode; title: string; sub: string };
    slice: { label: string; amount: string; meta: string; steps: { name: string; state: "done" | "now" | "todo" }[]; button: string; icon?: ReactNode };
  };
  proof: { value: string; label: string }[];
  how: { eyebrow: string; title: string; lead: string; steps: { title: string; body: string; image: Shot; top?: boolean }[] };
  features: { eyebrow: string; title: string; lead: string; tiles: TileData[] };
  contrast: {
    eyebrow: string;
    title: string;
    before: { tag: string; title: string; items: string[] };
    after: { tag: string; title: string; items: string[] };
    note?: ReactNode;
  };
  related: { eyebrow: string; title: string; cards: { href: string; title: string; body: string }[] };
  /** Posts from the topic cluster that supports this page. */
  furtherReading: { href: string; title: string; body: string }[];
  faqs: readonly { q: string; a: string }[];
  cta: { title: string; lead: string };
};

/**
 * One data-driven layout for the solution pages, built from the showcase
 * blocks, so every page gets real product screenshots, the same hierarchy and
 * its own accent colour, while the copy and SEO stay in the page file.
 */
export function ShowcasePage({ data }: { data: ShowcaseData }) {
  const { hero, how, features, contrast } = data;
  return (
    <ContentShell>
      <JsonLd data={faqLd(data.faqs)} />
      <ShowcaseRoot accent={data.accent}>
        <ShowcaseHero {...hero} />
        <ProofStrip items={data.proof} />

        <Band>
          <SectionHead eyebrow={how.eyebrow} title={how.title} lead={how.lead} />
          <Steps>
            {how.steps.map((s, i) => (
              <Step key={s.title} n={i + 1} title={s.title} body={s.body}>
                <Peek {...s.image} top={s.top} />
              </Step>
            ))}
          </Steps>
        </Band>

        <Band soft>
          <SectionHead eyebrow={features.eyebrow} title={features.title} lead={features.lead} />
          <Bento>
            {features.tiles.map((t) => (
              <Tile key={t.title} tone={t.tone} span2={t.span2} row2={t.row2} icon={t.icon} title={t.title} body={t.body}>
                {t.list && <T.List items={t.list} />}
                {t.chips && <T.Chips items={t.chips} />}
                {t.log && <T.Log items={t.log} />}
                {t.image && (
                  <T.Media>
                    <T.Img {...t.image} />
                  </T.Media>
                )}
                {t.zoom && (
                  <T.Media>
                    <T.Zoom {...t.zoom} />
                  </T.Media>
                )}
              </Tile>
            ))}
          </Bento>
        </Band>

        <Band>
          <SectionHead eyebrow={contrast.eyebrow} title={contrast.title} />
          <BeforeAfter before={contrast.before} after={contrast.after} />
          {contrast.note && <p style={{ margin: "28px 0 0", textAlign: "center", fontSize: 16, color: "var(--slate)" }}>{contrast.note}</p>}
        </Band>
      </ShowcaseRoot>

      <ShowcaseRoot accent={data.accent}>
        <Band soft>
          <SectionHead eyebrow={data.related.eyebrow} title={data.related.title} />
          <LinkCards cards={data.related.cards} />
        </Band>

        {data.furtherReading.length > 0 && (
          <Band>
            <SectionHead eyebrow="Further reading" title="Guides behind this topic." />
            <LinkCards cards={data.furtherReading} />
          </Band>
        )}

        <Band soft={data.furtherReading.length > 0}>
          <SectionHead eyebrow="FAQ" title="Questions, answered." />
          <Faq items={data.faqs} />
        </Band>

        <ShowcaseCta title={data.cta.title} lead={data.cta.lead} />
      </ShowcaseRoot>
    </ContentShell>
  );
}
