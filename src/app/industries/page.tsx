import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/welcome/content-blocks";
import { SITE } from "@/app/welcome/content";
import { INDUSTRIES_DATA } from "./industries-data";

const TITLE = "Industries";
const DESCRIPTION = `How ${SITE.name} fits the way each kind of manpower and workforce business actually staffs and bills.`;
const URL = "https://manpowersync.com/industries";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
};

export default function IndustriesIndexPage() {
  return (
    <ContentShell>
      <PageHero
        eyebrow="Industries"
        title="Built for the way your industry staffs."
        lead={DESCRIPTION}
      />
      <Section eyebrow="Choose yours" title="Six industries, one platform.">
        <LinkCardGrid
          cards={INDUSTRIES_DATA.map((i) => ({
            href: `/industries/${i.slug}`,
            title: i.name,
            body: i.description,
          }))}
        />
      </Section>
      <CtaBand
        title="Not sure which fits?"
        lead="Tell us how your workforce is deployed and billed, and we'll show you the parts that matter."
      />
    </ContentShell>
  );
}
