import type { Metadata } from "next";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { SolutionPage } from "@/app/(marketing)/welcome/solution-page";
import { PORTALS, SITE } from "@/app/(marketing)/welcome/content";

const TITLE = "Employee Self-Service Portal UAE";
const DESCRIPTION =
  "Workers check their attendance, download payslips and view their own documents from any phone browser — no app to install, no call to HR needed.";
const URL = "https://manpowersync.com/employee-self-service-portal-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "employee self service portal UAE",
    "worker payslip app UAE",
    "employee portal manpower software",
    "construction worker attendance app UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const EMPLOYEE_PORTAL = PORTALS.find((p) => p.title === "Employee self-service")!;
const PAGE_FAQS = [
  { q: "What can a worker see in the portal?", a: "Their own payslips, attendance history and personal documents, including passport, visa, Emirates ID and labour card details with expiry dates." },
  { q: "Does it work on any phone?", a: "Yes. It runs in any phone browser with no app to install and no minimum phone spec; a worker opens a link and signs in." },
  { q: "When does a payslip appear?", a: "Each month's payslip can be downloaded the day the payroll run is approved, with the same figures payroll approved." },
] as const;

export default function EmployeeSelfServicePage() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(PAGE_FAQS)} />
      <SolutionPage
        eyebrow="Employee self-service"
        title="Every worker's payslip, in their own pocket."
        lead={DESCRIPTION}
        note="Runs in any phone browser — nothing to install"
        pointsEyebrow="Built for the site, not the office"
        pointsTitle="A portal your workforce will actually use."
        points={[
          {
            icon: "phone",
            title: "Runs in any phone browser — nothing to install",
            body: "No app store, no download, no minimum phone spec. A worker opens a link, signs in, and sees their own record.",
          },
          {
            icon: "wallet",
            title: "Payslips and attendance without a call to HR",
            body: "“What did I get paid this month?” and “how many days did I work?” stop being questions that need a phone call — a worker can check both themselves, whenever they want.",
          },
          {
            icon: "document",
            title: "Their own documents, in one place",
            body: "Passport, visa, Emirates ID and labour card details a worker is entitled to see are available to them directly, instead of scattered across paper copies.",
          },
        ]}
        cardsEyebrow="The portal"
        cardsTitle={EMPLOYEE_PORTAL.title}
        cardsLead={EMPLOYEE_PORTAL.body}
        cards={[
          {
            tint: "rose",
            icon: "wallet",
            title: "Payslips",
            body: "Every month's payslip, downloadable the day the run is approved.",
            points: ["Monthly payslips", "Download as PDF", "Full history"],
          },
          {
            tint: "sky",
            icon: "clock",
            title: "Attendance history",
            body: "Days worked, overtime and absence, exactly as they were approved.",
            points: ["Days & overtime", "Absence records", "Per month"],
          },
          {
            tint: "mint",
            icon: "document",
            title: "Personal documents",
            body: "Their own passport, visa, Emirates ID and labour card details and expiry dates.",
            points: ["Own documents only", "Expiry dates", "No HR request needed"],
          },
        ]}
        visuals={[
          {
            visual: "employee",
            eyebrow: "On any phone",
            title: "A payslip a worker can open on the bus.",
            body: "Days worked, overtime, basic, allowances and net pay — the same figures payroll approved, in a browser, with no app to install.",
            points: ["Payslips", "Attendance history", "Personal documents"],
          },
        ]}
        relatedTitle="The other portals"
        related={[
          {
            href: "/supplier-portal-software-uae",
            title: "Supplier portal",
            body: "Subcontractors submitting their own workers, timesheets and tracking payments.",
          },
          {
            href: "/manpower-erp-uae",
            title: "Manpower ERP",
            body: "The staff workspace behind both portals — approvals, payroll, billing and compliance.",
          },
        ]}
        faqs={PAGE_FAQS}
        ctaTitle="Give your workforce their own portal."
        ctaLead={`Workers can sign in and see their first payslip the same day it's run on ${SITE.name}.`}
      />
    </ContentShell>
  );
}
