import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, LinkCardGrid, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import { SITE } from "@/app/(marketing)/welcome/content";
import p from "@/app/(marketing)/welcome/prose.module.css";
import { INDUSTRIES_DATA } from "./industries-data";

const TITLE = "Workforce Software by Industry (UAE)";
const DESCRIPTION = `How ${SITE.name} fits the way each kind of manpower and workforce business actually staffs and bills.`;
const URL = "https://manpowersync.com/industries";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "website" },
});

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
      <Section surface eyebrow="One platform" title="What stays the same, and what changes.">
        <div className={p.prose}>
          <p>
            Every manpower business in the UAE shares the same core: workers whose hours are approved, paid through the
            Wage Protection System and, for a supplier, billed to a client. Visas, Emirates IDs and labour cards have to
            stay valid, and many workers live in company accommodation and travel on company transport. That core is the
            same in every industry on this page.
          </p>
          <p>
            What changes is the shape of the work. Construction crews move between sites and trades, and facilities
            management runs many small contracts across scattered locations. Cleaning and hospitality teams turn over
            quickly on shift patterns, oil and gas deployments need site clearances and medical certification, and
            security services post guards to fixed sites around the clock. Each page shows how the same records and
            approvals are set up for that pattern.
          </p>
          <p>
            Not sure where you sit? Start with the closest match and read the{" "}
            <a href="/manpower-erp-uae">manpower ERP overview</a>, or see the{" "}
            <a href="/features">full list of modules</a>.
          </p>
        </div>
      </Section>
      <CtaBand
        title="Not sure which fits?"
        lead="Tell us how your workforce is deployed and billed, and we'll show you the parts that matter."
      />
    </ContentShell>
  );
}
