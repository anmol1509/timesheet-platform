import type { Metadata } from "next";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { ClipboardList, HardHat, LogOut, MapPin, Send, Users } from "lucide-react";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "Manpower Demand & Mobilisation Software UAE";
const DESCRIPTION =
  "Track every client request from enquiry and quotation through mobilisation, site arrival and demobilisation — and know exactly who's deployed where, today.";
const URL = "https://manpowersync.com/manpower-demand-mobilization-software-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["manpower demand management software", "workforce mobilization tracking UAE", "manpower deployment software UAE", "labour supply demand software"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "What is a demand request?", a: "A client's ask for a number of workers per trade against a project. It carries its quotation, the supplier offers sent for it and the workers eventually allocated, all on one record." },
  { q: "Can I see how many of the requested workers are filled?", a: "Yes. Each request shows requested against allocated per trade, with the offers sent and accepted from suppliers, so a shortfall is visible at a glance." },
  { q: "Is demobilisation recorded as well as mobilisation?", a: "Yes. The date a worker reached site and the date they left are both recorded, so a project's real workforce history is there when a client asks for it." },
] as const;

export default function DemandMobilizationPage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.rose,
        hero: {
          pill: "Demand & mobilisation",
          pillIcon: <ClipboardList size={14} aria-hidden />,
          title: (
            <>
              <em>Manpower demand and mobilisation software</em> for the UAE
            </>
          ),
          lead: "From a client's first ask to a worker's first day. Every request, quotation and mobilisation stays on one record.",
          ticks: ["Requested against allocated, per trade", "Supplier offers tracked on the request", "Site arrival and demobilisation recorded"],
          secondaryCta: { href: "/supplier-portal-software-uae", label: "See the supplier portal" },
          image: shot("sol-demand.webp", 1400, 690, "The Demand Requests list: each request with client and project, trades, requested and allocated numbers, supplier offers and status."),
          badge: { icon: <Send size={18} aria-hidden />, title: "2 supplier offers sent", sub: "1 accepted so far" },
          slice: {
            label: "Request #3 · Business Bay Mall Fit-out",
            amount: "4 / 16",
            meta: "Al Futtaim Engineering · 4 helpers, 12 painters",
            steps: [
              { name: "Raised", state: "done" },
              { name: "Quoted", state: "done" },
              { name: "Approved", state: "done" },
              { name: "Mobilised", state: "now" },
            ],
            button: "Allocate workers",
            icon: <Users size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "1", label: "record per request, from enquiry to demobilisation" },
          { value: "2", label: "views: a list and a board" },
          { value: "3", label: "stages tracked: planned, arrived on site, left" },
          { value: "0", label: "email threads needed to see where it stands" },
        ],
        how: {
          eyebrow: "One thread per request",
          title: "Every client request, tracked end to end.",
          lead: "A client's request, the quotation raised against it and the workers eventually mobilised all stay attached to the same record instead of being scattered across emails and files.",
          steps: [
            { title: "A client asks", body: "Each request is raised against a client project, per trade and quantity, and shows how much is still open and how urgent it is.", image: shot("sol-demand.webp", 1400, 690, "The demand request list with client, trades, requested and allocated numbers.") },
            { title: "Offers and approval", body: "Send the request to suppliers, track their offers as they come back, and approve per trade, with the whole exchange kept on the request.", image: shot("sol-vendor-demands.webp", 940, 500, "The supplier's view of the same requests, each marked You accepted, with trades and totals.") },
            { title: "Mobilise and track", body: "Approved demand becomes a mobilisation list with planned dates against the date workers actually reached site, and the date they leave is recorded too.", image: shot("sol-beds.webp", 1400, 940, "The bed allocation screen showing mobilised workers placed in camps, rooms and beds.") },
          ],
        },
        features: {
          eyebrow: "The module",
          title: "Projects, sites and demand in one place.",
          lead: "Know exactly who is deployed where, today, instead of a spreadsheet someone updates when they remember.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <ClipboardList size={22} aria-hidden />, title: "From enquiry to quotation to mobilisation, one thread", body: "A client's request, the quotation raised against it, and the workers eventually mobilised all stay attached to the same record.", list: ["Per-trade line items, rates and quantities", "Quote to approval tracked", "Allocation progress per request"], image: { ...shot("sol-demand.webp", 1400, 690, "The demand request list with allocation progress."), fade: true } },
            { tone: "tint", span2: true, icon: <HardHat size={22} aria-hidden />, title: "Know exactly who's deployed where, today", body: "A worker's current project and site are always on their record, not a spreadsheet updated when someone remembers.", chips: ["Current project", "Current site", "Client", "Trade"] },
            { tone: "sky", icon: <Send size={22} aria-hidden />, title: "Supplier offers", body: "Sent, answered and accepted, per request.", list: ["Offers sent", "Accepted count"] },
            { tone: "violet", icon: <LogOut size={22} aria-hidden />, title: "Demobilisation", body: "The date a worker left, recorded.", chips: ["Arrival", "Departure"] },
            { span2: true, icon: <MapPin size={22} aria-hidden />, title: "Both ends of a deployment", body: "The date a worker actually left a site matters as much as when they arrived. Both are recorded, so a project's real workforce history is there when a client asks for it.", log: [{ what: "Request raised for 12 painters", who: "Against a client project" }, { what: "Supplier offer accepted", who: "Attached to the request" }, { what: "Workers mobilised to site", who: "Planned and actual dates" }, { what: "Worker demobilised", who: "Departure date recorded" }] },
            { span2: true, icon: <Users size={22} aria-hidden />, title: "Housing follows the deployment", body: "Mobilised crews need beds and transport, allocated against the sites they're actually working.", image: { ...shot("sol-camps.webp", 1400, 940, "The camps screen with room-by-room bed allocation."), fade: true } },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Requests without the email trail.",
          before: { tag: "Emails and sheets", title: "Reconstructed on demand", items: ["Requests scattered across inboxes", "Quotes in one file, workers in another", "Shortfalls found when the client calls", "Deployments updated when someone remembers", "Departure dates rarely recorded"] },
          after: { tag: "With ManpowerSync", title: "One record per request", items: ["Request, quote and workers together", "Requested against allocated at a glance", "Supplier offers tracked on the request", "Current project and site on the worker record", "Arrival and departure both kept"] },
        },
        related: {
          eyebrow: "What happens next",
          title: "After mobilisation.",
          cards: [
            { href: "/timesheet-software-construction-uae", title: "Timesheet software", body: "Once mobilised, a worker's hours flow into the same approval queue as everyone else's." },
            { href: "/camp-accommodation-management-software-uae", title: "Camp & accommodation", body: "Mobilised crews need beds and transport, allocated against the sites they're actually working." },
          ],
        },
        furtherReading: postsForPillar("/manpower-demand-mobilization-software-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: `Track your next mobilisation on ${SITE.name}.`, lead: "From the client's first enquiry to the worker's first day on site." },
      }}
    />
  );
}
