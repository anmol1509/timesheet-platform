import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { PORTALS, FAQS, SITE } from "@/app/welcome/content";

const TITLE = "Employee Self-Service Portal for UAE Manpower Suppliers";
const DESCRIPTION =
  "Workers check their attendance, download payslips and view their own documents from any phone browser — no app to install, no call to HR needed.";
const URL = "https://manpowersync.com/employee-self-service-portal-uae";

export const metadata: Metadata = {
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
};

const EMPLOYEE_PORTAL = PORTALS.find((p) => p.title === "Employee self-service")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "Do workers need to install an app?");

export default function EmployeeSelfServicePage() {
  return (
    <ContentShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_SLICE.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
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
        faqs={FAQ_SLICE}
        ctaTitle="Give your workforce their own portal."
        ctaLead={`Workers can sign in and see their first payslip the same day it's run on ${SITE.name}.`}
      />
    </ContentShell>
  );
}
