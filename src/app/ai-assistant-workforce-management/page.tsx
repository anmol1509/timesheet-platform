import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { SolutionPage } from "@/app/welcome/solution-page";
import { DEEP_DIVES, FAQS, SITE } from "@/app/welcome/content";

const TITLE = "AI Assistant for Workforce & Compliance Data (UAE)";
const DESCRIPTION =
  "Ask your workforce data a plain-language question and get an answer with a link to the record it came from — permission-aware, so nobody sees more than their role already allows.";
const URL = "https://manpowersync.com/ai-assistant-workforce-management";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "AI assistant manpower software",
    "AI ERP assistant UAE",
    "workforce AI assistant construction",
    "AI document extraction UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
};

const ASSISTANT = DEEP_DIVES.find((d) => d.eyebrow === "Built-in assistant")!;
const DOCUMENTS = DEEP_DIVES.find((d) => d.eyebrow === "Documents & compliance")!;
const FAQ_SLICE = FAQS.filter((f) => f.q === "Who can see salary and client data?");

export default function AiAssistantPage() {
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
        eyebrow="Built-in assistant"
        title="Ask your data a question. Get the answer, with links."
        lead={DESCRIPTION}
        note="Answers respect each user's own permissions"
        pointsEyebrow="AI where it earns its place"
        pointsTitle="AI built into the system you already use."
        points={[
          {
            icon: "bot",
            title: "Ask in plain language, get an answer from live data",
            body: "“Which visas expire this month?” “How many welders are on Site 14?” — questions like these are answered directly from your current records, not a canned report you have to go find.",
          },
          {
            icon: "lock",
            title: "Permission-aware, every time",
            body: "The assistant answers within whatever a user is already allowed to see — it can never surface salary, another branch's data, or anything outside their role, no matter how the question is phrased.",
          },
          {
            icon: "document",
            title: "Every answer links back to the record",
            body: "An answer isn't a dead end — it links straight to the employee, project or document it came from, so the next step (renew a visa, check a timesheet) is one click away.",
          },
        ]}
        cardsEyebrow="Two kinds of AI"
        cardsTitle="Asking questions, and reading documents."
        cards={[
          {
            tint: "lavender",
            icon: "bot",
            title: ASSISTANT.title,
            body: ASSISTANT.body,
            points: ASSISTANT.points,
          },
          {
            tint: "sky",
            icon: "sparkles",
            title: DOCUMENTS.title,
            body: DOCUMENTS.body,
            points: DOCUMENTS.points,
          },
        ]}
        relatedTitle="Where the answers come from"
        related={[
          {
            href: "/manpower-erp-uae",
            title: "Manpower ERP",
            body: "The records the assistant reads from — workforce, projects, payroll and compliance in one place.",
          },
          {
            href: "/blog/visa-emirates-id-expiry-compliance-checklist",
            title: "Expiry compliance checklist",
            body: "The document-expiry problem the assistant and the alerts are built to solve.",
          },
        ]}
        faqs={FAQ_SLICE}
        ctaTitle="See the assistant on your own workforce data."
        ctaLead={`It's built into ${SITE.name} from day one — no extra module, no separate subscription.`}
      />
    </ContentShell>
  );
}
