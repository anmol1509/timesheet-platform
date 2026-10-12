import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { PORTALS, FAQS, SITE } from "@/app/welcome/content";

const TITLE = "Subcontractor & Supplier Portal Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Give subcontractors their own portal to receive demands, submit workers and timesheets, and track their payments — without another forwarded spreadsheet or follow-up call.";
const URL = "https://manpowersync.com/supplier-portal-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "subcontractor management software UAE",
    "supplier portal software UAE",
    "manpower subcontractor tracking software",
    "vendor management construction UAE",
    "subcontractor timesheet portal",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const SUPPLIER_PORTAL = PORTALS.find((p) => p.title === "Supplier portal")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "How do subcontractors fit in?");

export default function SupplierPortalPage() {
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
        eyebrow="Supplier portal"
        title="Subcontractor crews, off email and into one system."
        lead={DESCRIPTION}
        note="Suppliers see their own demands and payments — nothing of yours"
        pointsEyebrow="How it works for them"
        pointsTitle="Your subcontractors, working from the same records as you."
        points={[
          {
            icon: "users",
            title: "Subcontractors submit workers and timesheets themselves",
            body: "Instead of a spreadsheet emailed back and forth, a subcontractor logs into their own portal to submit the crew and hours against a demand — the same record your own team approves from.",
          },
          {
            icon: "send",
            title: "A demand, its quote and its workers, in one thread",
            body: "A request for a trade goes out, the subcontractor quotes and proposes workers against it, and the whole exchange stays attached to that one demand instead of scattered across emails.",
          },
          {
            icon: "wallet",
            title: "Payment status they can check themselves",
            body: "A subcontractor can see what's been approved and what's been paid without a phone call to your finance team — fewer “any update on our payment?” messages for everyone.",
          },
        ]}
        cardsEyebrow="The portal"
        cardsTitle={SUPPLIER_PORTAL.title}
        cardsLead={SUPPLIER_PORTAL.body}
        cards={[
          {
            tint: "yellow",
            icon: "send",
            title: "Demands & workers",
            body: "Suppliers receive your demand for a trade, quote against it, and propose the specific workers they'd send.",
            points: ["Demand notifications", "Quotes per trade line", "Worker submissions"],
          },
          {
            tint: "peach",
            icon: "clock",
            title: "Timesheets & payments",
            body: "Their crews' hours are submitted into the same approval queue, and payment status is visible to them without asking.",
            points: ["Timesheet submission", "Approval visibility", "Payment tracking"],
          },
          {
            tint: "gray",
            icon: "lock",
            title: "Walled off from your data",
            body: "A supplier sees only their own demands, workers and payments — never your clients, margins or other suppliers.",
            points: ["Own records only", "Separate sign-in", "No internal access"],
          },
        ]}
        visuals={[
          {
            visual: "supplier",
            eyebrow: "What a supplier sees",
            title: "Their demands, their crews, their payments.",
            body: "A subcontractor signs in to their own portal, quotes against your demand, submits the workers and hours, and follows the payment — without seeing anything else of yours.",
            points: ["Own records only", "Timesheet submission", "Payment visibility"],
          },
        ]}
        relatedTitle="The other portals"
        related={[
          {
            href: "/employee-self-service-portal-uae",
            title: "Employee portal",
            body: "Payslips, attendance and documents for every worker, from any phone browser.",
          },
          {
            href: "/manpower-erp-uae",
            title: "Manpower ERP",
            body: "The staff workspace the supplier portal feeds into — approvals, payroll and billing.",
          },
        ]}
        faqs={FAQ_SLICE}
        ctaTitle={`Bring your subcontractors onto ${SITE.name}.`}
        ctaLead="Invite a supplier and they can submit their first crew the same day."
      />
    </ContentShell>
  );
}
