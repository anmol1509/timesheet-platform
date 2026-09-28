"use client";

import type { Tint } from "./content";
import {
  ChipRow,
  CtaBand,
  FaqList,
  type IconName,
  LinkCardGrid,
  PageHero,
  PointGrid,
  Section,
  StatsRow,
  TintCardGrid,
} from "./content-blocks";

export type SolutionPageData = {
  eyebrow: string;
  title: string;
  lead: string;
  note?: string;
  /** Three-up "why this is different" cards. */
  pointsEyebrow?: string;
  pointsTitle: string;
  pointsLead?: string;
  points: readonly { icon: IconName; title: string; body: string }[];
  /** Optional tinted module cards. */
  cardsEyebrow?: string;
  cardsTitle?: string;
  cardsLead?: string;
  cards?: readonly { tint: Tint; icon?: IconName; title: string; body: string; points?: readonly string[] }[];
  /** Optional chip row (capability bullets). */
  chipsEyebrow?: string;
  chipsTitle?: string;
  chipsLead?: string;
  chips?: readonly string[];
  /** Optional stat strip. */
  facts?: readonly { value: string; label: string }[];
  /** Optional related-page cards. */
  relatedTitle?: string;
  related?: readonly { href: string; title: string; body: string }[];
  faqs?: readonly { q: string; a: string }[];
  ctaTitle: string;
  ctaLead: string;
};

/** One layout for every solution/landing page, so they all carry the
 * homepage's design language instead of each being its own thing. */
export function SolutionPage(data: SolutionPageData) {
  return (
    <>
      <PageHero eyebrow={data.eyebrow} title={data.title} lead={data.lead} note={data.note} />

      <Section
        surface
        eyebrow={data.pointsEyebrow ?? "Why it's different"}
        title={data.pointsTitle}
        lead={data.pointsLead}
      >
        <PointGrid points={data.points} />
      </Section>

      {data.cards && data.cards.length > 0 && (
        <Section eyebrow={data.cardsEyebrow} title={data.cardsTitle} lead={data.cardsLead}>
          <TintCardGrid cards={data.cards} columns={data.cards.length === 3 ? 3 : 2} />
        </Section>
      )}

      {data.chips && data.chips.length > 0 && (
        <Section surface eyebrow={data.chipsEyebrow} title={data.chipsTitle} lead={data.chipsLead}>
          <ChipRow items={data.chips} />
        </Section>
      )}

      {data.facts && data.facts.length > 0 && (
        <Section flush>
          <StatsRow facts={data.facts} />
        </Section>
      )}

      {data.related && data.related.length > 0 && (
        <Section eyebrow="Explore" title={data.relatedTitle ?? "Related"}>
          <LinkCardGrid cards={data.related} columns={data.related.length === 3 ? 3 : 2} />
        </Section>
      )}

      {data.faqs && data.faqs.length > 0 && (
        <Section surface eyebrow="FAQ" title="Questions, answered.">
          <FaqList items={data.faqs} />
        </Section>
      )}

      <CtaBand title={data.ctaTitle} lead={data.ctaLead} />
    </>
  );
}
