import type { Metadata } from "next";
import { Bus, BedDouble, Building2, History, Route, ShieldAlert } from "lucide-react";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "Labour Camp Management Software UAE";
const DESCRIPTION =
  "Manage labour camps room by room with live occupancy, check workers in and out, and plan transport routes and vehicles against the sites your crews are working at today.";
const URL = "https://manpowersync.com/camp-accommodation-management-software-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["camp and accommodation management software UAE", "labour camp management software", "worker accommodation software UAE", "transport and camp management construction", "bed occupancy software UAE"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "Can I see which beds are free tonight?", a: "Yes. Camps are managed block by block, room by room and bed by bed, and assigning, moving or freeing a bed updates occupancy immediately." },
  { q: "Is the history of who stayed where kept?", a: "Every move in and out of a room is recorded against the worker and the bed, so a question about who was where on a given night has an answer." },
  { q: "How is transport planned?", a: "Routes and vehicles are planned against the sites your crews are deployed to today, with seats and pick-up times per route, rather than a fixed schedule." },
] as const;

export default function CampAccommodationPage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.orange,
        hero: {
          pill: "Accommodation & transport",
          pillIcon: <Building2 size={14} aria-hidden />,
          title: (
            <>
              <em>Labour camp management software</em> for the UAE
            </>
          ),
          lead: "Know who sleeps where and who rides which bus. Bed-level occupancy, not a headcount against a building.",
          ticks: ["Room-by-room, bed-by-bed occupancy", "Check-in and check-out history", "Routes planned against live deployment"],
          secondaryCta: { href: "/manpower-erp-uae", label: "See the full ERP" },
          image: shot("sol-camps.webp", 1400, 940, "The Camps screen: 60 beds, 24 occupied, 40% occupancy, and Camp A rooms with each bed and its worker."),
          badge: { icon: <ShieldAlert size={18} aria-hidden />, title: "2 vehicle documents due", sub: "Flagged before they expire" },
          slice: {
            label: "Camp A: Al Quoz",
            amount: "12 / 30 beds",
            meta: "2 camps · 60 beds · 40% occupied",
            steps: [
              { name: "Check in", state: "done" },
              { name: "Room", state: "done" },
              { name: "Bed", state: "done" },
              { name: "Roster", state: "now" },
            ],
            button: "Check in a worker",
            icon: <BedDouble size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "Bed", label: "level occupancy, not a headcount per building" },
          { value: "2", label: "clicks to move a worker to another room or camp" },
          { value: "1", label: "history of every move in and out of a room" },
          { value: "Live", label: "seat use per vehicle, with documents due flagged" },
        ],
        how: {
          eyebrow: "From arrival to the morning run",
          title: "Check in, give a bed, put them on the bus.",
          lead: "A workforce spread across camps and sites, in one view.",
          steps: [
            { title: "Check workers in", body: "Move workers into a camp and give them a bed in one go. Those still waiting are listed so nobody is left without a place.", image: shot("sol-beds.webp", 1400, 940, "The bed allocation screen with checked-in workers, their camp, room and bed.") },
            { title: "See occupancy, bed by bed", body: "Every block, room and bed with its current occupant, so what's free tonight is a number on screen rather than a phone call to the camp boss.", image: shot("sol-camps.webp", 1400, 940, "Camp A rooms showing each bed and who sleeps in it, with a vacant-only filter.") },
            { title: "Plan the transport", body: "Vehicles, drivers and rosters, with the daily pickup runs planned against the sites your crews are working at today.", image: shot("sol-transport.webp", 1400, 940, "The Transport screen with four vehicles, seats used against capacity, documents due and the pickup runs.") },
          ],
        },
        features: {
          eyebrow: "The modules",
          title: "Accommodation & transport, together.",
          lead: "Camps, beds, vehicles and routes sit on the same worker records as the rest of the business.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <BedDouble size={22} aria-hidden />, title: "Know who sleeps where, room by room", body: "Camps are managed bed by bed. Assigning, moving or freeing a bed updates occupancy immediately, so a camp manager always knows exactly what's free tonight.", list: ["Room-by-room layout", "Live occupancy and vacant filter", "Move a worker in two clicks"], image: { ...shot("sol-camps.webp", 1400, 940, "The camps screen with occupancy and rooms."), fade: true } },
            { tone: "tint", span2: true, icon: <History size={22} aria-hidden />, title: "Check-in and check-out history, not just a snapshot", body: "Every move in and out of a room is recorded against the worker and the bed, so a dispute over who was where on a given night has an answer, not a guess.", chips: ["Check-in", "Check-out", "Room moves", "Bed history"] },
            { tone: "sky", icon: <Route size={22} aria-hidden />, title: "Routes per site", body: "Pickup runs planned against where crews work.", list: ["Seats and timings", "Vehicle assignment"] },
            { tone: "violet", icon: <ShieldAlert size={22} aria-hidden />, title: "Documents due", body: "Vehicle registration and insurance flagged early.", chips: ["Registration", "Insurance"] },
            { span2: true, icon: <Bus size={22} aria-hidden />, title: "Transport planned against where crews actually work", body: "Vehicles, drivers, seats used and the daily pickup runs, instead of a fixed schedule that stops matching reality the moment a crew moves sites.", image: { ...shot("sol-transport.webp", 1400, 940, "The transport screen with vehicles, drivers and seat use."), fade: true } },
            { span2: true, icon: <Building2 size={22} aria-hidden />, title: "On the same worker records", body: "Camps and transport sit alongside the rest of the workforce record, not in a separate system.", image: { ...shot("sol-beds.webp", 1400, 940, "The bed allocation list showing each worker's nationality, supplier and bed."), fade: true } },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Camps without the phone calls.",
          before: { tag: "A camp register and WhatsApp", title: "Occupancy by phone call", items: ["Free beds known by asking the camp boss", "No record of who slept where on a given night", "Moves between rooms tracked on paper", "Vehicle papers expire unnoticed", "Routes that stop matching where crews work"] },
          after: { tag: "With ManpowerSync", title: "Occupancy as a number on screen", items: ["Live occupancy by room and bed", "Every move recorded against worker and bed", "Move a worker in two clicks", "Registration and insurance flagged early", "Routes planned against current deployment"] },
        },
        related: {
          eyebrow: "Related",
          title: "Connected modules.",
          cards: [
            { href: "/manpower-erp-uae", title: "Manpower ERP", body: "Camps and transport sit alongside the rest of the workforce record, not in a separate system." },
            { href: "/manpower-demand-mobilization-software-uae", title: "Demand & mobilisation", body: "Where crews get deployed in the first place, which decides whose bed and bus this is." },
          ],
        },
        furtherReading: postsForPillar("/camp-accommodation-management-software-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: `See your camps and routes on ${SITE.name}.`, lead: "Bring your current camp and bed list. Nothing to re-key before your first month." },
      }}
    />
  );
}
