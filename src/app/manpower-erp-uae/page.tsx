import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { CAPABILITIES, DEEP_DIVES, FACTS, FAQS, SITE } from "@/app/welcome/content";
import { SOLUTIONS_DATA } from "@/app/solutions/solutions-data";

const TITLE = "Manpower ERP for UAE Manpower Suppliers";
const DESCRIPTION =
  "A manpower ERP built for UAE labour supply companies: timesheets, WPS payroll, client billing, visa/Emirates ID compliance, camps and transport in one system.";
const URL = "https://manpowersync.com/manpower-erp-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "manpower ERP",
    "manpower ERP UAE",
    "manpower ERP software",
    "manpower management software UAE",
    "labour supply ERP Dubai",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const FAQ_SLICE = FAQS.slice(0, 4);

export default function ManpowerErpUaePage() {
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
        eyebrow="Manpower ERP"
        title="Your whole manpower business, in one system."
        lead={DESCRIPTION}
        note="Bring your existing Excel timesheets, no re-keying"
        pointsEyebrow="Why a manpower ERP"
        pointsTitle="Why manpower suppliers need their own ERP, not a general HR system."
        points={[
          {
            icon: "leak",
            title: "Built for a workforce you bill by the hour",
            body: "A generic HRMS stops at employee records and internal payroll. A manpower ERP also turns approved hours into client invoices, tracks which client each worker is deployed to, and handles subcontractor crews as first-class citizens.",
          },
          {
            icon: "id",
            title: "UAE compliance is the day-to-day job",
            body: "Visa, Emirates ID, labour card and passport expiries drive daily operations for a manpower supplier — not a once-a-year HR task. The system has to surface what's expiring, for whom, before it becomes a fine.",
          },
          {
            icon: "wps",
            title: "Payroll that produces a WPS file your bank accepts",
            body: "Hundreds of workers, paid monthly through the Wage Protection System — the ERP needs to get bank details, salary structure and the SIF export right the first time, every month.",
          },
        ]}
        cardsEyebrow="The platform"
        cardsTitle="Everything a manpower ERP needs to cover."
        cardsLead="Operations, HR, payroll and finance share one set of records, so the hours your supervisors approve are the hours you bill and the hours you pay."
        cards={CAPABILITIES}
        visuals={[
          {
            visual: "timesheet",
            eyebrow: "Timesheets & attendance",
            title: "Hours arrive in every format. They leave in one.",
            body: "Drop in the monthly workbook and every month tab is detected and reconciled against your roster. Exceptions and overtime are flagged as they come in, and supervisors sign off in one queue.",
            points: ["Excel workbook import", "Manual & client timesheets", "Overtime and rest-day rules"],
          },
          {
            visual: "documents",
            eyebrow: "Documents & compliance",
            title: "Passports, visas and Emirates IDs, read for you.",
            body: "Upload a scan and the key fields are extracted into the employee record. Expiry dates surface long before they become a fine, and letters and NOCs generate from your own templates in one click.",
            points: ["AI document extraction", "Expiry alerts", "Letter & NOC templates"],
          },
          {
            visual: "camps",
            eyebrow: "Accommodation & transport",
            title: "Know who sleeps where and who rides which bus.",
            body: "Camps managed room by room with live occupancy, workers checked in and out, and transport routes planned against the sites your crews are working at today.",
            points: ["Camps & bed allocation", "Live occupancy", "Vehicles & routes"],
          },
        ]}
        facts={FACTS}
        chipsEyebrow="Compliance & operations"
        chipsTitle="Covered end to end."
        chipsLead={DEEP_DIVES.map((d) => d.eyebrow).join(" · ")}
        chips={DEEP_DIVES.flatMap((d) => d.points)}
        relatedTitle="Go deeper on each piece"
        related={SOLUTIONS_DATA.filter((s) => s.slug !== "manpower-erp-uae").map((s) => ({
          href: `/${s.slug}`,
          title: s.label,
          body: s.description,
        }))}
        faqs={FAQ_SLICE}
        ctaTitle={`See ${SITE.name} on your own workforce.`}
        ctaLead="Bring your current timesheet workbook — nothing to re-key before your first month."
      />
    </ContentShell>
  );
}
