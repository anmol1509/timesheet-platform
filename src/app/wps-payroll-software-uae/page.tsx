import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { CAPABILITIES, FAQS, SITE } from "@/app/welcome/content";

const TITLE = "WPS Payroll Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Run payroll for hundreds of workers from approved hours, apply overtime, loans and gratuity automatically, and export a bank-ready WPS SIF file every month.";
const URL = "https://manpowersync.com/wps-payroll-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "WPS payroll software UAE",
    "WPS SIF software",
    "SIF file generator UAE",
    "payroll software Dubai manpower",
    "manpower payroll UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const PAYROLL = CAPABILITIES.find((c) => c.title === "Payroll & WPS")!;
const FAQ_SLICE = FAQS.filter((f) =>
  ["Does payroll produce a WPS file our bank accepts?", "Who can see salary and client data?"].includes(f.q)
);

export default function WpsPayrollSoftwarePage() {
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
        eyebrow="Payroll & WPS"
        title="From approved hours to a bank-ready WPS file."
        lead={DESCRIPTION}
        note="Overtime, loans and gratuity applied the same way every month"
        pointsEyebrow="Built for monthly WPS runs"
        pointsTitle="Payroll for a workforce paid monthly, through WPS."
        points={[
          {
            icon: "wps",
            title: "A SIF file your bank actually accepts",
            body: "Bank and routing details, labour card numbers and salary figures come straight from the employee record used every month, not re-typed into a fresh spreadsheet each time — the single biggest cause of a rejected file.",
          },
          {
            icon: "wallet",
            title: "Overtime, loans and gratuity, calculated the same way every time",
            body: "Payroll runs from approved hours with each employee's pay structure — itemised, flat or hourly — applied consistently, including overtime multipliers, recurring loan deductions and end-of-service gratuity.",
          },
          {
            icon: "shield",
            title: "Approval limits and a four-eyes check before money moves",
            body: "A payroll run above a set threshold can't be approved by the same person who created it, and every figure is written to the audit log — so a payroll error is caught before the transfer, not after.",
          },
        ]}
        cardsEyebrow="The module"
        cardsTitle={PAYROLL.title}
        cardsLead={PAYROLL.body}
        cards={[
          {
            tint: "mint",
            icon: "wps",
            title: "WPS / SIF export",
            body: "A salary information file built from each employee's stored bank and routing details, ready to upload to your bank or exchange house.",
            points: ["Bank & routing details on file", "Built from approved payroll", "Re-exportable per run"],
          },
          {
            tint: "sky",
            icon: "wallet",
            title: "Pay structures that fit the roster",
            body: "Itemised (basic plus allowances), flat monthly, or hourly — with overtime and rest-day premiums applied on top automatically.",
            points: ["Itemised, flat or hourly", "Overtime multipliers", "Loans & recurring pay items"],
          },
          {
            tint: "lavender",
            icon: "shield",
            title: "Approvals and the audit trail",
            body: "Approval thresholds, a four-eyes rule above them, and a complete record of who changed what and when.",
            points: ["Approval thresholds", "Four-eyes above the limit", "Full audit log"],
          },
        ]}
        relatedTitle="Before and after payroll"
        related={[
          {
            href: "/timesheet-software-construction-uae",
            title: "Timesheet software",
            body: "Where the approved hours payroll runs from actually come from — Excel, manual entry or supplier submissions.",
          },
          {
            href: "/construction-invoicing-software-uae",
            title: "Billing & VAT invoicing",
            body: "The same approved hours, turned into VAT-ready client invoices instead of a second spreadsheet.",
          },
          {
            href: "/blog/wps-sif-rejection-reasons-uae",
            title: "Why SIF files get rejected",
            body: "The most common reasons a WPS salary file bounces back, and how to stop them recurring every month.",
          },
        ]}
        faqs={FAQ_SLICE}
        ctaTitle={`Run this month's payroll on ${SITE.name}.`}
        ctaLead="Bring your employees' bank details as they stand today — nothing to re-key before your first run."
      />
    </ContentShell>
  );
}
