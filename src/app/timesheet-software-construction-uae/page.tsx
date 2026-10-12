import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { CAPABILITIES, FAQS, STEPS, SITE } from "@/app/welcome/content";

const TITLE = "Timesheet Software for Construction & Manpower Teams in the UAE";
const DESCRIPTION =
  "Bring in hours from Excel workbooks, manual entry or supplier submissions, apply overtime and rest-day rules automatically, and send approved hours straight to invoices and payroll.";
const URL = "https://manpowersync.com/timesheet-software-construction-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "timesheet software construction UAE",
    "construction timesheet software Dubai",
    "manpower timesheet app UAE",
    "attendance software construction UAE",
    "client timesheet software UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const TIMESHEETS = CAPABILITIES.find((c) => c.title === "Timesheets & attendance")!;
const FAQ_SLICE = FAQS.filter((f) =>
  ["Can we bring our existing Excel timesheets?", "How is this different from a general HRMS or ERP?"].includes(f.q)
);

export default function TimesheetSoftwarePage() {
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
        eyebrow="Timesheets & attendance"
        title="Enter hours once. Everything else follows."
        lead={DESCRIPTION}
        note="Upload your current workbook as-is — every month tab is detected automatically"
        pointsEyebrow="However hours arrive"
        pointsTitle="One system for hours, however they come in."
        points={[
          {
            icon: "sheet",
            title: "Hours arrive however your sites actually work",
            body: "The same consolidated Excel workbook your sites already send in, entered manually for a site with no system, or submitted by a subcontractor through their own portal — one system reconciles all three.",
          },
          {
            icon: "check",
            title: "Overtime and rest-day rules applied automatically",
            body: "Exceptions and overtime are flagged as hours come in, not worked out by hand at month end. Supervisors sign off in one approval queue instead of chasing a dozen separate sheets.",
          },
          {
            icon: "receipt",
            title: "Approved hours flow straight to invoices and payroll",
            body: "The same approved hours become client invoices and payroll input — nothing gets re-typed between the team that tracks attendance and the teams that bill and pay.",
          },
        ]}
        cardsEyebrow="How it works"
        cardsTitle="From hours to paid, in three steps."
        cards={STEPS.map((step, i) => ({
          tint: (["sky", "mint", "peach"] as const)[i],
          icon: (["sheet", "check", "wallet"] as const)[i],
          title: `${step.n} · ${step.title}`,
          body: step.body,
        }))}
        visuals={[
          {
            visual: "timesheet",
            eyebrow: "The approval queue",
            title: "Exceptions surface before month end, not after.",
            body: "Overtime over threshold, missing days and rest-day work are flagged as hours arrive. Supervisors approve in one queue, and every change lands in the audit log.",
            points: ["Overtime flagged automatically", "One approval queue", "Full audit trail"],
          },
        ]}
        chipsEyebrow="The module"
        chipsTitle={TIMESHEETS.title}
        chipsLead={TIMESHEETS.body}
        chips={TIMESHEETS.points}
        relatedTitle="What approved hours feed"
        related={[
          {
            href: "/wps-payroll-software-uae",
            title: "WPS payroll software",
            body: "Approved hours become a payroll run and a bank-ready WPS salary file, without re-entry.",
          },
          {
            href: "/construction-invoicing-software-uae",
            title: "Billing & VAT invoicing",
            body: "The same approved hours become VAT-ready client invoices at each client's own agreed rate.",
          },
        ]}
        faqs={FAQ_SLICE}
        ctaTitle={`Bring this month's timesheets to ${SITE.name}.`}
        ctaLead="Upload your current workbook as-is — every month tab is detected and reconciled automatically."
      />
    </ContentShell>
  );
}
