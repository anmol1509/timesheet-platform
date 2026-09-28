import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { DEEP_DIVES, FAQS, SITE } from "@/app/welcome/content";

const TITLE = "Camp & Accommodation Management Software for UAE Manpower Suppliers";
const DESCRIPTION =
  "Manage labour camps room by room with live occupancy, check workers in and out, and plan transport routes and vehicles against the sites your crews are working at today.";
const URL = "https://manpowersync.com/camp-accommodation-management-software-uae";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "camp and accommodation management software UAE",
    "labour camp management software",
    "worker accommodation software UAE",
    "transport and camp management construction",
    "bed occupancy software UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const ACCOMMODATION = DEEP_DIVES.find((d) => d.eyebrow === "Accommodation & transport")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "How is this different from a general HRMS or ERP?");

export default function CampAccommodationPage() {
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
        eyebrow="Accommodation & transport"
        title="Know who sleeps where and who rides which bus."
        lead={DESCRIPTION}
        note="Bed-level occupancy, not a headcount against a building"
        pointsEyebrow="Camps & routes"
        pointsTitle="A workforce spread across camps and sites, in one view."
        points={[
          {
            icon: "bed",
            title: "Know who sleeps where, room by room",
            body: "Camps are managed bed by bed, not as a headcount against a building. Assigning, moving or freeing a bed updates occupancy immediately, so a camp manager always knows exactly what's free tonight.",
          },
          {
            icon: "check",
            title: "Check-in and check-out history, not just a snapshot",
            body: "Every move in and out of a room is recorded against the worker and the bed, so a dispute over who was where on a given night has an answer — not a guess.",
          },
          {
            icon: "bus",
            title: "Transport planned against where crews actually work",
            body: "Routes and vehicles are planned against the sites your workforce is deployed to today, not a fixed schedule that stops matching reality the moment a crew moves sites.",
          },
        ]}
        cardsEyebrow="The modules"
        cardsTitle={ACCOMMODATION.title}
        cardsLead={ACCOMMODATION.body}
        cards={[
          {
            tint: "mint",
            icon: "bed",
            title: "Camps & bed allocation",
            body: "Blocks, rooms and beds with live occupancy, so free capacity tonight is a number you can see rather than a phone call.",
            points: ["Room-by-room layout", "Live occupancy", "Check-in history"],
          },
          {
            tint: "sky",
            icon: "bus",
            title: "Vehicles & routes",
            body: "Transport routes and vehicles planned against current site deployment, with seats and pick-up times per route.",
            points: ["Routes per site", "Vehicle assignment", "Seats & timings"],
          },
        ]}
        relatedTitle="Related"
        related={[
          {
            href: "/manpower-erp-uae",
            title: "Manpower ERP",
            body: "Camps and transport sit alongside the rest of the workforce record, not in a separate system.",
          },
          {
            href: "/manpower-demand-mobilization-software-uae",
            title: "Demand & mobilisation",
            body: "Where crews get deployed in the first place — which decides whose bed and bus this is.",
          },
        ]}
        faqs={FAQ_SLICE}
        ctaTitle={`See your camps and routes on ${SITE.name}.`}
        ctaLead="Bring your current camp and bed list — nothing to re-key before your first month."
      />
    </ContentShell>
  );
}
