import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { SITE } from "@/app/welcome/content";
import type { IconName } from "@/app/welcome/content-blocks";
import { INDUSTRIES_DATA } from "../industries-data";

export function generateStaticParams() {
  return INDUSTRIES_DATA.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const industry = INDUSTRIES_DATA.find((i) => i.slug === slug);
  if (!industry) return {};
  const url = `https://manpowersync.com/industries/${industry.slug}`;
  return {
    title: industry.title,
    description: industry.description,
    keywords: [...industry.keywords],
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title: industry.title, description: industry.description, url, type: "article" },
  };
}

const POINT_ICONS: IconName[] = ["hardhat", "wps", "bed"];

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = INDUSTRIES_DATA.find((i) => i.slug === slug);
  if (!industry) notFound();

  return (
    <ContentShell>
      <SolutionPage
        eyebrow={`For ${industry.name}`}
        title={industry.title}
        lead={industry.description}
        pointsEyebrow="Built for this industry"
        pointsTitle={`Built for how ${industry.name.toLowerCase()} actually staffs.`}
        pointsLead={industry.intro}
        points={industry.differentiators.map((d, i) => ({
          icon: POINT_ICONS[i % POINT_ICONS.length],
          title: d.title,
          body: d.body,
        }))}
        visuals={[
          {
            visual: "timesheet",
            eyebrow: "The daily screen",
            title: "Hours in, approved, and on to payroll and invoices.",
            body: "Whatever your crews do on site, the office side is the same: hours arrive, exceptions get flagged, a supervisor approves, and the same figures become payroll and the client's invoice.",
            points: ["One approval queue", "Straight to payroll", "Straight to invoicing"],
          },
          {
            visual: "documents",
            eyebrow: "Compliance",
            title: "Expiries surface before they become fines.",
            body: "Visas, Emirates IDs, labour cards, medicals and any site clearance your work needs, tracked on the employee record with alerts well before the date.",
            points: ["AI document extraction", "Expiry alerts", "Letters & NOCs"],
          },
        ]}
        relatedTitle="The platform behind it"
        related={[
          {
            href: "/manpower-erp-uae",
            title: "Manpower ERP",
            body: "The full platform this runs on — workforce, timesheets, payroll, billing and compliance in one system.",
          },
          {
            href: "/wps-payroll-software-uae",
            title: "WPS payroll software",
            body: "Monthly payroll from approved hours, exported as a bank-ready WPS salary file.",
          },
          {
            href: "/timesheet-software-construction-uae",
            title: "Timesheet software",
            body: "Excel, manual and supplier-submitted hours reconciled and approved in one queue.",
          },
        ]}
        ctaTitle={`See ${SITE.name} built for ${industry.name.toLowerCase()}.`}
        ctaLead="Bring your current workforce sheet — nothing to re-key before your first month."
      />
    </ContentShell>
  );
}
