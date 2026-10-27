import type { Metadata } from "next";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { Bot, FileScan, Link2, Lock, Search, Sparkles } from "lucide-react";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/app/(marketing)/welcome/content";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ShowcasePage, shot } from "@/app/(marketing)/welcome/showcase/showcase-page";

const TITLE = "AI Assistant for Workforce Data (UAE)";
const DESCRIPTION =
  "Ask your workforce data a plain-language question and get an answer with a link to the record it came from. Permission-aware, so nobody sees more than their role already allows.";
const URL = "https://manpowersync.com/ai-assistant-workforce-management";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["AI assistant manpower software", "AI ERP assistant UAE", "workforce AI assistant construction", "AI document extraction UAE"],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "What kind of questions can I ask the assistant?", a: "Plain-language questions about your live records, such as which visas expire this month or how many welders are on a given site." },
  { q: "Can the assistant show salary data to anyone who asks?", a: "No. It answers within whatever the person asking is already allowed to see, so it cannot surface salary, another company's data or anything outside their role." },
  { q: "What can it read from uploaded documents?", a: "Upload a passport, visa or Emirates ID and the key fields are extracted onto the employee record, which avoids the retyping that causes WPS rejections." },
] as const;

export default function AiAssistantPage() {
  return (
    <ShowcasePage
      data={{
        accent: ACCENTS.fuchsia,
        hero: {
          pill: "Built-in assistant",
          pillIcon: <Sparkles size={14} aria-hidden />,
          title: (
            <>
              An <em>AI assistant for workforce data</em>, with links to the record
            </>
          ),
          lead: "Ask your data a question in plain language and get the answer with a link to where it came from, within each person's own permissions.",
          ticks: ["Answers from your live records", "Permission-aware, every time", "Every answer links to the record"],
          secondaryCta: { href: "/manpower-erp-uae", label: "See the ERP behind it" },
          image: shot("sol-assistant.webp", 1400, 940, "The My Assistant panel open over the dashboard, listing what needs attention today, such as an overdue invoice and approved hours not yet invoiced, each with an Open button and a Why? link."),
          badge: { icon: <Lock size={18} aria-hidden />, title: "Permission-aware", sub: "Only what your role allows" },
          slice: {
            label: "Needs attention today",
            amount: "AED 42,395",
            meta: "approved but not invoiced · 3 client months",
            steps: [
              { name: "Question", state: "done" },
              { name: "Answer", state: "done" },
              { name: "Record link", state: "done" },
              { name: "Next step", state: "now" },
            ],
            button: "Create the invoices",
            icon: <Link2 size={16} aria-hidden />,
          },
        },
        proof: [
          { value: "1", label: "click from an answer to the record it came from" },
          { value: "0", label: "extra permissions: it answers within the asker's own" },
          { value: "Why?", label: "every item can explain where it came from" },
          { value: "3", label: "kinds of work: ask, act, extract from documents" },
        ],
        how: {
          eyebrow: "AI where it earns its place",
          title: "Ask, read the answer, open the record.",
          lead: "AI built into the system you already use, not a separate tool to copy data into.",
          steps: [
            { title: "It tells you what needs attention", body: "Open the assistant and see what needs you today: an expired document, an overdue invoice, approved hours not yet invoiced.", image: shot("sol-assistant.webp", 1400, 940, "The assistant panel with needs-attention items, each with an Open button.") },
            { title: "You ask in plain language", body: "Questions like \"Which visas expire this month?\" or \"How many welders are on Site 14?\" are answered from your current records, not a canned report you have to go find.", image: shot("sol-assistant.webp", 1400, 940, "The assistant's ask box and suggested questions such as where to renew a visa."), top: true },
            { title: "Every answer links back", body: "An answer isn't a dead end. It links to the employee, project or document it came from, so the next step is one click away.", image: shot("sol-erp-dash.webp", 1400, 940, "The dashboard that the assistant's links open onto, showing workforce, deployment and what needs attention.") },
          ],
        },
        features: {
          eyebrow: "Two kinds of AI",
          title: "Asking questions, and reading documents.",
          lead: "Both work on your own records, inside the permissions you already set.",
          tiles: [
            { tone: "dark", span2: true, row2: true, icon: <Bot size={22} aria-hidden />, title: "Ask in plain language, get an answer from live data", body: "Questions are answered directly from your current records, with a link to what the answer is based on and a way to see why it was raised.", list: ["Plain-language questions", "Needs-attention list with Why?", "Open straight to the record"], image: { ...shot("sol-assistant.webp", 1400, 940, "The My Assistant panel."), fade: true } },
            { tone: "tint", span2: true, icon: <Lock size={22} aria-hidden />, title: "Permission-aware, every time", body: "The assistant answers within whatever a user is already allowed to see. It can't surface salary, another company's data or anything outside their role, however the question is phrased.", chips: ["Role-based", "Branch-aware", "No extra access"] },
            { tone: "sky", icon: <Search size={22} aria-hidden />, title: "Links to the record", body: "Every answer opens the employee, project or document.", list: ["One click to act", "No dead ends"] },
            { tone: "violet", icon: <FileScan size={22} aria-hidden />, title: "Reads documents", body: "A scan in, a filled-in record out.", chips: ["Passport", "Visa", "Emirates ID"] },
            { span2: true, icon: <FileScan size={22} aria-hidden />, title: "A scan in, a filled-in employee record out", body: "Upload a passport, visa or Emirates ID and the key fields are extracted onto the record, the same data entry that causes WPS rejections when it's retyped by hand.", list: ["AI document extraction", "Expiry alerts", "Fewer retyping errors"] },
            { span2: true, icon: <Sparkles size={22} aria-hidden />, title: "Built in, not bolted on", body: "It's part of the platform from day one, reading the same records as every module: workforce, projects, payroll and compliance.", image: { ...shot("sol-erp-dash.webp", 1400, 940, "The dashboard the assistant reads from."), fade: true } },
          ],
        },
        contrast: {
          eyebrow: "Before and after",
          title: "Answers without the report hunt.",
          before: { tag: "Reports and spreadsheets", title: "Find the right report first", items: ["Which report holds this answer?", "Export, filter, then ask someone to check it", "Salary exposed because a sheet got shared", "Document fields retyped by hand", "The next step is a separate search"] },
          after: { tag: "With ManpowerSync", title: "Ask, then act", items: ["Ask the question directly", "Answered from live records", "Only what your role allows", "Fields read from the document scan", "A link straight to the next step"] },
        },
        related: {
          eyebrow: "Where the answers come from",
          title: "The records behind it.",
          cards: [
            { href: "/manpower-erp-uae", title: "Manpower ERP", body: "The records the assistant reads from: workforce, projects, payroll and compliance in one place." },
            { href: "/blog/visa-emirates-id-expiry-compliance-checklist", title: "Expiry compliance checklist", body: "The document-expiry problem the assistant and the alerts are built to solve." },
          ],
        },
        furtherReading: postsForPillar("/ai-assistant-workforce-management").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description })),
        faqs: PAGE_FAQS,
        cta: { title: "See the assistant on your own workforce data.", lead: `It's built into ${SITE.name} from day one: no extra module, no separate subscription.` },
      }}
    />
  );
}
