import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { CAPABILITIES, SITE } from "@/app/welcome/content";

const TITLE = "Manpower Demand & Mobilization Tracking Software for UAE";
const DESCRIPTION =
  "Track every client request from enquiry and quotation through mobilisation, site arrival and demobilisation — and know exactly who's deployed where, today.";
const URL = "https://manpowersync.com/manpower-demand-mobilization-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "manpower demand management software",
    "workforce mobilization tracking UAE",
    "manpower deployment software UAE",
    "labour supply demand software",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const PROJECTS = CAPABILITIES.find((c) => c.title === "Projects, sites & demand")!;

export default function DemandMobilizationPage() {
  return (
    <ContentShell>
      <SolutionPage
        eyebrow="Demand & mobilisation"
        title="From a client's first ask to a worker's first day."
        lead={DESCRIPTION}
        note="Enquiry, quotation, mobilisation and demobilisation on one record"
        pointsEyebrow="One thread per request"
        pointsTitle="Every client request, tracked end to end."
        points={[
          {
            icon: "send",
            title: "From enquiry to quotation to mobilisation, one thread",
            body: "A client's request, the quotation raised against it, and the workers eventually mobilised all stay attached to the same record instead of scattered across emails and separate files.",
          },
          {
            icon: "hardhat",
            title: "Know exactly who's deployed where, today",
            body: "A worker's current project and site are always on their record — not a spreadsheet someone updates when they remember to.",
          },
          {
            icon: "check",
            title: "Demobilisation tracked, not just mobilisation",
            body: "The date a worker actually left a site matters as much as when they arrived — both are recorded, so a project's real workforce history is there when a client asks for it.",
          },
        ]}
        cardsEyebrow="The module"
        cardsTitle={PROJECTS.title}
        cardsLead={PROJECTS.body}
        cards={[
          {
            tint: "lavender",
            icon: "send",
            title: "Enquiries & quotations",
            body: "A client enquiry becomes a quotation with per-trade line items, rates and quantities, tracked through to acceptance.",
            points: ["Per-trade line items", "Client-specific rates", "Quote to approval"],
          },
          {
            tint: "sky",
            icon: "hardhat",
            title: "Mobilisation & site arrival",
            body: "Approved demand becomes a mobilisation list, with planned dates against the date workers actually reached site.",
            points: ["Mobilisation lists", "Site-arrival confirmation", "Demobilisation records"],
          },
        ]}
        visuals={[
          {
            visual: "demand",
            eyebrow: "One request, end to end",
            title: "Enquiry, quote, approval, mobilisation — one record.",
            body: "Each stage of a client's request stays attached to the same demand, so anyone can see where it stands without reconstructing it from an email thread.",
            points: ["Enquiries & quotations", "Per-trade approval", "Site arrival & demobilisation"],
          },
        ]}
        relatedTitle="What happens next"
        related={[
          {
            href: "/timesheet-software-construction-uae",
            title: "Timesheet software",
            body: "Once mobilised, a worker's hours flow into the same approval queue as everyone else's.",
          },
          {
            href: "/camp-accommodation-management-software-uae",
            title: "Camp & accommodation",
            body: "Mobilised crews need beds and transport — allocated against the sites they're actually working.",
          },
        ]}
        ctaTitle={`Track your next mobilisation on ${SITE.name}.`}
        ctaLead="From the client's first enquiry to the worker's first day on site."
      />
    </ContentShell>
  );
}
