import type { Metadata } from "next";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { SolutionPage } from "@/app/(marketing)/welcome/solution-page";
import { DEEP_DIVES, SITE } from "@/app/(marketing)/welcome/content";

const TITLE = "Labour Camp Management Software UAE";
const DESCRIPTION =
  "Manage labour camps room by room with live occupancy, check workers in and out, and plan transport routes and vehicles against the sites your crews are working at today.";
const URL = "https://manpowersync.com/camp-accommodation-management-software-uae";

export const metadata: Metadata = finishMetadata({
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
});

const ACCOMMODATION = DEEP_DIVES.find((d) => d.eyebrow === "Accommodation & transport")!;
const PAGE_FAQS = [
  { q: "Can I see which beds are free tonight?", a: "Yes. Camps are managed block by block, room by room and bed by bed, and assigning, moving or freeing a bed updates occupancy immediately." },
  { q: "Is the history of who stayed where kept?", a: "Every move in and out of a room is recorded against the worker and the bed, so a question about who was where on a given night has an answer." },
  { q: "How is transport planned?", a: "Routes and vehicles are planned against the sites your crews are deployed to today, with seats and pick-up times per route, rather than a fixed schedule." },
] as const;

export default function CampAccommodationPage() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(PAGE_FAQS)} />
      <SolutionPage
        furtherReading={postsForPillar("/camp-accommodation-management-software-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description }))}
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
        visuals={[
          {
            visual: "camps",
            eyebrow: "Live occupancy",
            title: "Bed by bed, not a headcount against a building.",
            body: "Every block, room and bed with its current occupant, so what's free tonight is a number on screen rather than a phone call to the camp boss.",
            points: ["Room-by-room layout", "Check-in & check-out history", "Routes against live deployment"],
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
        faqs={PAGE_FAQS}
        ctaTitle={`See your camps and routes on ${SITE.name}.`}
        ctaLead="Bring your current camp and bed list — nothing to re-key before your first month."
      />
    </ContentShell>
  );
}
