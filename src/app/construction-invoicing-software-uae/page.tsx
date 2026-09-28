import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { CAPABILITIES, SITE } from "@/app/welcome/content";

const TITLE = "VAT Invoicing & Billing Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Turn approved timesheet hours into VAT-ready client invoices, and keep bills, expenses and payments in one ledger instead of three separate spreadsheets.";
const URL = "https://manpowersync.com/construction-invoicing-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "construction invoicing software UAE",
    "VAT invoice software UAE manpower",
    "manpower billing software UAE",
    "client invoicing software construction UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const BILLING = CAPABILITIES.find((c) => c.title === "Billing & finance")!;

export default function InvoicingSoftwarePage() {
  return (
    <ContentShell>
      <SolutionPage
        eyebrow="Billing & finance"
        title="Every approved hour, billed."
        lead={DESCRIPTION}
        note="No separate billing spreadsheet to drift out of sync with payroll"
        pointsEyebrow="Close the revenue leak"
        pointsTitle="Stop letting approved hours slip away before they're billed."
        points={[
          {
            icon: "receipt",
            title: "Invoices generated from the same approved hours as payroll",
            body: "The hours a client's timesheet approver signed off on are the same hours that become their invoice — no separate billing spreadsheet that can drift out of sync with what payroll actually paid.",
          },
          {
            icon: "shield",
            title: "VAT-ready by default",
            body: "Invoices are structured to match UAE VAT requirements, so finance isn't reformatting every export before it goes out.",
          },
          {
            icon: "wallet",
            title: "Bills, expenses and payments in one ledger",
            body: "What you owe suppliers, what you've spent, and what clients have paid live together — not across three tools that need reconciling by hand at month end.",
          },
        ]}
        cardsEyebrow="The module"
        cardsTitle={BILLING.title}
        cardsLead={BILLING.body}
        cards={[
          {
            tint: "peach",
            icon: "receipt",
            title: "Invoices from timesheets",
            body: "Each client's invoice is generated against their agreed rate and the hours actually approved at their sites.",
            points: ["Per-client rates", "Per-project overrides", "Nothing re-keyed"],
          },
          {
            tint: "mint",
            icon: "wallet",
            title: "Bills, expenses & payments",
            body: "Supplier bills, staff expenses and client payments in one ledger, with ageing and statements per partner.",
            points: ["Supplier bills & ageing", "Expenses with approvals", "Payment tracking"],
          },
        ]}
        relatedTitle="Where the hours come from"
        related={[
          {
            href: "/timesheet-software-construction-uae",
            title: "Timesheet software",
            body: "Excel, manual and supplier-submitted hours, reconciled and approved in one queue.",
          },
          {
            href: "/wps-payroll-software-uae",
            title: "WPS payroll software",
            body: "The same approved hours, run through payroll and exported as a bank-ready WPS file.",
          },
        ]}
        ctaTitle={`Bill this month's approved hours on ${SITE.name}.`}
        ctaLead="See how much revenue is currently slipping through the gap between timesheets and invoices."
      />
    </ContentShell>
  );
}
