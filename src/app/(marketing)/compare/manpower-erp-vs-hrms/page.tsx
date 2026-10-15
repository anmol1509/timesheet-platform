import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import p from "@/app/(marketing)/welcome/prose.module.css";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { COMPARISONS } from "../compare-data";
import { ComparisonTable } from "../comparison-table";

const c = COMPARISONS.find((x) => x.slug === "manpower-erp-vs-hrms")!;

export const metadata: Metadata = finishMetadata({
  title: c.title,
  description: c.description,
  keywords: ["manpower ERP vs HRMS", "HRMS for manpower supply company UAE", "difference between ERP and HRMS", "labour supply software vs HR software"],
  alternates: { canonical: `${SITE_URL}/compare/${c.slug}` },
});

const FAQS = [
  {
    q: "What is the difference between an HRMS and a manpower ERP?",
    a: "An HRMS manages your own employees: records, leave, attendance and internal payroll. A manpower ERP also runs the business of supplying workers to clients: billing by the hour, deployments by client and trade, visa and ID tracking, camps and transport, and subcontractor crews.",
  },
  {
    q: "Can we use an HRMS together with a separate invoicing tool?",
    a: "You can, but the approved hours have to move from one to the other, usually by export and re-entry. That is the step where mismatches and disputes start. A system where payroll and invoices read from the same approved hours removes it.",
  },
  {
    q: "Do we need a manpower ERP if we only supply a few dozen workers?",
    a: "It depends on how you bill. If you bill clients by the hour for deployed workers, you already have the needs an ERP covers, whatever the headcount. If you only manage your own staff and do not bill hours to clients, a general HRMS is probably enough.",
  },
  {
    q: "Can a manpower ERP replace our HRMS?",
    a: "For employee records, attendance, payroll, documents and employee self-service, yes: it covers the same ground and adds the supplier-specific parts. Check any system against your own checklist first; our buyer's guide lists 12 questions to ask.",
  },
] as const;

const ROWS = [
  ["Employee records", "Personal details, contracts and documents for your own staff.", "The same, plus the trade each worker is deployed as, their client, project and site."],
  ["Payroll", "Typically built around monthly salaried staff.", "Payroll from approved hours, with overtime, loans and gratuity, and a WPS file export."],
  ["Client billing", "Usually out of scope, so invoices are built elsewhere.", "VAT-ready client invoices generated from the same approved hours that drive payroll."],
  ["Timesheets", "Attendance for internal staff.", "Client timesheets, Excel workbook import, manual entry and supplier-submitted hours, in one approval queue."],
  ["Visa, ID and labour card tracking", "Varies by product; often a basic expiry field.", "Expiry alerts, document extraction from scans, and letters and NOCs from your own templates."],
  ["Demand to deployment", "Not covered.", "Each client request tracked from enquiry and quotation through mobilisation, site arrival and demobilisation."],
  ["Camps and transport", "Not covered.", "Bed-level occupancy, check-in and check-out history, and routes planned against where crews are deployed."],
  ["Subcontractors", "Not covered.", "A supplier portal for demands, workers, timesheets and payment tracking."],
  ["Worker access", "Often an employee portal.", "An employee portal in any phone browser, for payslips, attendance and documents."],
] as const;

export default function CompareHrmsPage() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(FAQS)} />
      <PageHero
        eyebrow="Compare"
        title="Manpower ERP vs a general HRMS."
        lead="Both manage employees. Only one is built for a business that sells their hours to clients. Here is where the line falls."
        cta={false}
      />

      <Section>
        <div className={p.prose}>
          <h2>What a general HRMS does well</h2>
          <p>
            A general HR system is good at the lifecycle of an employee: joining, records, leave, attendance
            and payroll for your own team. If that is the whole job, because your workers are not billed
            by the hour to clients, a general HRMS may be all you need.
          </p>

          <h2>Where a manpower supplier needs more</h2>
          <p>
            A supplier&rsquo;s product is its workers&rsquo; hours. That adds work that general HR software is
            not designed around: turning approved hours into client invoices, knowing which client and site
            each worker is on today, keeping visas and permits valid across hundreds of people, housing and
            moving crews, and managing subcontractors. Each of those is a place where, without it, the
            numbers live in a spreadsheet beside the HR system.
          </p>

          <h2>Side by side</h2>
          <p>
            HRMS products differ a great deal, so the middle column describes what is <em>typical</em>.
            Check any product you are considering against it.
          </p>
          <ComparisonTable columns={["What you need to do", "General HRMS (typical)", "Manpower ERP (ManpowerSync)"]} rows={ROWS} />

          <h2>How to decide</h2>
          <ul>
            <li>Do you bill clients by the hour for deployed workers? If yes, you need billing tied to approved hours.</li>
            <li>Do you track visas, Emirates IDs and labour cards for a large workforce? Look for expiry alerts you do not have to check manually.</li>
            <li>Do you run camps, transport or subcontractor crews? These are rarely in an HR system.</li>
            <li>Do you export payroll to the WPS system every month? Check the file is generated from the same records, not retyped.</li>
          </ul>
          <p>
            Our <a href="/blog/manpower-supply-software-uae-buyers-checklist">buyer&rsquo;s checklist</a> turns these
            into 12 questions to put to any vendor. If you are coming from spreadsheets rather than an HR
            system, read <a href="/compare/manpowersync-vs-excel">ManpowerSync vs Excel</a>.
          </p>

          <h2>See the platform</h2>
          <p>
            Learn what a <a href="/manpower-erp-uae">manpower ERP</a> covers, or look at the parts that general
            HR systems leave out: <a href="/construction-invoicing-software-uae">billing and VAT invoicing</a>,{" "}
            <a href="/camp-accommodation-management-software-uae">camp management</a> and the{" "}
            <a href="/supplier-portal-software-uae">supplier portal</a>.
          </p>

          <h2>Frequently asked questions</h2>
          {FAQS.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand
        title="See what your HR system leaves out."
        lead="Bring your current workbook and tell us how you bill clients. We'll show you the parts that matter."
      />
    </ContentShell>
  );
}
