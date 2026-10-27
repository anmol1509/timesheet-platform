import type { Metadata } from "next";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { Banknote, Clock, Lock, Send, Users, Wallet } from "lucide-react";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "Subcontractor Portal Software UAE";
const DESCRIPTION =
  "Give subcontractors their own portal to receive demands, submit workers and timesheets, and track their payments. Without another forwarded spreadsheet or follow-up call.";
const URL = "https://manpowersync.com/supplier-portal-software-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["subcontractor management software UAE", "supplier portal software UAE", "manpower subcontractor tracking software", "vendor management construction UAE", "subcontractor timesheet portal"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "What can a subcontractor see in the portal?", a: "Only their own demands, workers and payments. They never see your clients, margins or other suppliers, and they sign in separately from your staff." },
  { q: "How do subcontractors submit their crews' hours?", a: "Through their own portal, into the same approval queue your team approves from, instead of by emailed spreadsheet." },
  { q: "How does a demand work with a supplier?", a: "A request for a trade goes out, the subcontractor quotes against it and proposes the specific workers they would send, and the whole exchange stays attached to that one demand." },
] as const;

export default function SupplierPortalPage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.violet,
        hero: {
          pill: "Supplier portal",
          pillIcon: <Users size={14} aria-hidden />,
          title: (
            <>
              A <em>subcontractor portal</em> for UAE manpower suppliers
            </>
          ),
          lead: "Subcontractor crews, off email and into one system. Suppliers see their own demands and payments, and nothing of yours.",
          ticks: ["Demands answered with a quote", "Workers and timesheets submitted by them", "Payment status they can check themselves"],
          secondaryCta: { href: "/employee-self-service-portal-uae", label: "See the employee portal" },
          image: shot("sol-vendor-home.webp", 940, 590, "The supplier portal home for Gulf Manpower Services: requests to answer, workers, documents due, AED 22,220 still owed, and approval status badges."),
          badge: { icon: <Lock size={18} aria-hidden />, title: "Their records only", sub: "Separate sign-in" },
          slice: {
            label: "Still owed to you",
            amount: "AED 22,220",
            meta: "1 invoice awaiting approval",
            steps: [
              { name: "Demand", state: "done" },
              { name: "Quote", state: "done" },
              { name: "Workers", state: "done" },
              { name: "Paid", state: "now" },
            ],
            button: "Check payments",
            icon: <Wallet size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "1", label: "thread per demand: request, quote and workers together" },
          { value: "0", label: "of your clients, margins or other suppliers visible to them" },
          { value: "1", label: "approval queue, shared with your own team's hours" },
          { value: "24/7", label: "payment status without a call to finance" },
        ],
        how: {
          eyebrow: "How it works for them",
          title: "Your subcontractors, working from the same records as you.",
          lead: "Instead of a spreadsheet emailed back and forth, a subcontractor signs in to their own portal.",
          steps: [
            { title: "You send a demand", body: "A request for a trade goes out from your demand list, with the offers sent and accepted tracked on the request.", image: shot("sol-demand.webp", 1400, 690, "The staff-side demand list showing supplier offers sent and accepted per request."), top: true },
            { title: "They quote and propose workers", body: "The subcontractor answers each request in their portal, accepting with a quote or declining with a reason, and proposes the specific workers they would send.", image: shot("sol-vendor-demands.webp", 940, 500, "The supplier portal's Demands list with three requests, each marked You accepted.") },
            { title: "They submit hours and follow payment", body: "Their crews' hours go into the same approval queue your team approves from, and approved and paid status is visible to them without a phone call.", image: shot("sol-vendor-home.webp", 940, 590, "The supplier portal home showing AED 22,220 still owed and one invoice awaiting approval.") },
          ],
        },
        features: {
          eyebrow: "The portal",
          title: "Supplier portal, walled off from your data.",
          lead: "Subcontractors submit their own workers and hours, and see only what is theirs.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <Send size={22} aria-hidden />, title: "A demand, its quote and its workers, in one thread", body: "A request for a trade goes out, the subcontractor quotes and proposes workers against it, and the whole exchange stays attached to that one demand instead of scattered across emails.", list: ["Demand notifications", "Quotes per trade line", "Worker submissions"], image: { ...shot("sol-vendor-demands.webp", 940, 500, "The supplier portal Demands list."), fade: true } },
            { tone: "tint", span2: true, icon: <Clock size={22} aria-hidden />, title: "Timesheets & payments", body: "Their crews' hours are submitted into the same approval queue, and payment status is visible to them without asking.", chips: ["Timesheet submission", "Approval visibility", "Payment tracking"] },
            { tone: "sky", icon: <Lock size={22} aria-hidden />, title: "Walled off", body: "A supplier sees only their own demands, workers and payments.", list: ["Own records only", "Separate sign-in"] },
            { tone: "violet", icon: <Banknote size={22} aria-hidden />, title: "Payments", body: "What's approved and what's paid.", chips: ["Approved", "Paid"] },
            { span2: true, icon: <Users size={22} aria-hidden />, title: "Subcontractors submit workers themselves", body: "A subcontractor logs in to submit the crew and hours against a demand, the same record your own team approves from.", log: [{ what: "Demand received", who: "Notification to the supplier" }, { what: "Quote and workers submitted", who: "Against the trade line" }, { what: "Hours submitted for approval", who: "Into your approval queue" }, { what: "Payment marked paid", who: "Visible in their portal" }] },
            { span2: true, icon: <Wallet size={22} aria-hidden />, title: "Fewer \"any update on our payment?\" messages", body: "A subcontractor can see what's been approved and what's been paid without a phone call to your finance team.", image: { ...shot("sol-vendor-home.webp", 940, 590, "The supplier portal home with the amount still owed."), fade: true } },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Subcontractors without the forwarded spreadsheets.",
          before: { tag: "Email and WhatsApp", title: "Chasing every crew", items: ["Crew lists emailed back and forth", "Quotes lost in long threads", "Hours retyped from supplier sheets", "Payment status asked by phone", "Everyone sees a different version"] },
          after: { tag: "With ManpowerSync", title: "They work from the same record", items: ["Suppliers submit their own workers", "Quote and workers on the demand", "Hours straight into your approval queue", "Payment status visible to them", "Their records only, a separate sign-in"] },
        },
        related: {
          eyebrow: "The other portals",
          title: "Connected modules.",
          cards: [
            { href: "/employee-self-service-portal-uae", title: "Employee portal", body: "Payslips, attendance and documents for every worker, from any phone browser." },
            { href: "/manpower-erp-uae", title: "Manpower ERP", body: "The staff workspace the supplier portal feeds into: approvals, payroll and billing." },
          ],
        },
        furtherReading: postsForPillar("/supplier-portal-software-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: `Bring your subcontractors onto ${SITE.name}.`, lead: "Invite a supplier and they can submit their first crew the same day." },
      }}
    />
  );
}
