import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { Wrench } from "lucide-react";
import { ACCENTS, Band, HowStrip, LinkCards, SectionHead, ShowcaseCta, ShowcaseRoot, ToolHero } from "@/app/(marketing)/welcome/showcase/showcase";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "./tools-data";

const TITLE = "Free UAE Payroll & Manpower Tools";
const DESCRIPTION =
  "Free tools for UAE manpower suppliers: a WPS SIF file checker, UAE IBAN validator, gratuity and hourly rate calculators, and a labour supply timesheet template. No sign-up, and nothing you type leaves your browser.";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tools` },
});

export default function ToolsIndexPage() {
  return (
    <ContentShell>
      <ShowcaseRoot accent={ACCENTS.indigo}>
        <ToolHero
          pill="Free tools"
          pillIcon={<Wrench size={14} aria-hidden />}
          title={
            <>
              Free <em>tools</em> for UAE manpower suppliers
            </>
          }
          lead={DESCRIPTION}
          badges={["Free, no sign-up", "Runs in your browser", "Built on the rules the product uses"]}
        />
        <Band>
          <SectionHead eyebrow="Pick a tool" title="Check a file, price a worker, run the numbers." />
          <LinkCards cards={TOOLS.map((t) => ({ href: `/tools/${t.slug}`, title: t.label, body: t.description }))} />
        </Band>
        <Band soft>
          <SectionHead eyebrow="Why free" title="Private by design." />
          <HowStrip
            steps={[
              { title: "Nothing is uploaded", body: "Files and figures are checked in your browser. We never see or store a salary file or an IBAN." },
              { title: "Same rules as the product", body: "The calculators use the same code ManpowerSync runs for payroll, gratuity and pricing." },
              { title: "No account needed", body: "Open a tool and use it. If you later want it automated, the platform does it every month." },
            ]}
          />
        </Band>
        <ShowcaseCta title="Run payroll, gratuity and billing from one system." lead="The same rules these tools use are built into ManpowerSync's payroll and invoicing." />
      </ShowcaseRoot>
    </ContentShell>
  );
}
