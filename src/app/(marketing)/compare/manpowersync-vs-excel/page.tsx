import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import p from "@/app/(marketing)/welcome/prose.module.css";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { COMPARISONS } from "../compare-data";
import { ComparisonTable } from "../comparison-table";

const c = COMPARISONS.find((x) => x.slug === "manpowersync-vs-excel")!;

export const metadata: Metadata = finishMetadata({
  title: c.title,
  description: c.description,
  keywords: ["manpower software vs Excel", "Excel timesheet alternative UAE", "replace Excel manpower supply", "manpower ERP vs spreadsheet"],
  alternates: { canonical: `${SITE_URL}/compare/${c.slug}` },
});

const FAQS = [
  {
    q: "Can we keep our Excel timesheets and still use ManpowerSync?",
    a: "Yes. Upload the consolidated workbook as it is and each month tab is detected and reconciled against your roster. Re-uploading a corrected file updates that month instead of creating duplicates, so there is nothing to re-key before your first month.",
  },
  {
    q: "Is Excel enough for a small manpower supplier?",
    a: "For a handful of workers and a single client, often yes. The trouble starts when the same hours have to feed payroll, a WPS file and invoices for several clients, because each one is another copy that can drift from the others.",
  },
  {
    q: "How is access controlled compared with a shared workbook?",
    a: "A shared workbook is usually all or nothing. ManpowerSync controls access by role and company, down to the module and action, and records every create, edit and delete in an audit log.",
  },
  {
    q: "What does it cost?",
    a: "Plans start at AED 500 a month for up to 200 members, with Pro at AED 1,000 a month for up to 500 members. Hosting and database are included. See the pricing page for details.",
  },
] as const;

const ROWS = [
  ["Timesheets", "One workbook per client or month, copied between files and chased by email.", "Upload the monthly workbook and every month tab is detected and reconciled; add manual and client timesheets, or let suppliers submit their own."],
  ["Overtime and rest days", "Formulas rebuilt in each sheet, and breaking when a sheet is copied or edited.", "Overtime and rest-day rules applied consistently from approved hours."],
  ["Payroll and WPS", "Salaries and the SIF file assembled by hand or with macros.", "Payroll from approved hours, with loans and gratuity, exported as a WPS file using each employee's bank and routing details."],
  ["Client invoices", "Hours retyped into an invoice template.", "VAT-ready invoices generated from the same approved hours that drive payroll."],
  ["Visa and ID expiry", "A date column that someone has to remember to check.", "Expiry alerts on each employee record, with key fields read from uploaded scans."],
  ["Who can see what", "The whole file or nothing.", "Role-based permissions down to module and action, plus company-level access."],
  ["History and audit", "Cells overwritten with no record of who changed what.", "Every create, edit and delete written to an audit log."],
  ["Camps and transport", "Separate sheets that fall out of date as crews move.", "Bed-level camp occupancy, check-in and check-out history, and routes planned against current deployment."],
  ["Subcontractors", "Spreadsheets forwarded by email.", "A supplier portal for demands, workers, timesheets and payments."],
  ["Worker access", "Payslips and attendance sent individually, or not at all.", "An employee portal, in any phone browser, for payslips, attendance and documents."],
] as const;

export default function CompareExcelPage() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(FAQS)} />
      <PageHero
        eyebrow="Compare"
        title="ManpowerSync vs Excel for manpower supply."
        lead="Excel is where most UAE manpower suppliers start. Here is where it keeps working, where it stops, and what changes when you move."
        cta={false}
      />

      <Section>
        <div className={p.prose}>
          <h2>Where Excel works well</h2>
          <p>
            Excel is familiar, flexible and already paid for. With a small workforce, one or two clients and
            one person who owns the workbook, it can do the job, and a system may be more than you need yet.
            The problems are not about spreadsheets being bad. They appear when one set of hours has to feed
            several outputs.
          </p>

          <h2>Side by side</h2>
          <ComparisonTable columns={["What you need to do", "In Excel", "In ManpowerSync"]} rows={ROWS} />

          <h2>Signs it is time to move</h2>
          <ol>
            <li>The same hours are typed into payroll, the WPS file and a client invoice.</li>
            <li>A salary file has been rejected, and you could not tell which row caused it. See <a href="/blog/wps-sif-rejection-reasons-uae">why WPS SIF files get rejected</a>.</li>
            <li>A visa or Emirates ID lapsed because nobody checked the date column.</li>
            <li>An invoice was disputed and you could not show how the hours were approved. See <a href="/blog/stop-client-timesheet-disputes-labour-supply-invoices">how to stop client timesheet disputes</a>.</li>
            <li>Only one person understands the workbook, and the answer to &ldquo;who is where today&rdquo; depends on them.</li>
          </ol>

          <h2>What moving looks like</h2>
          <p>
            Employees and sites are imported from your existing sheets, and your current timesheet workbook can
            be uploaded as it is, so there is nothing to re-key before your first month. You keep working the
            way you do now while the system takes over the repeated steps: approval, payroll, the WPS file and
            invoicing.
          </p>
          <p>
            See the pieces in detail: <a href="/timesheet-software-construction-uae">timesheet software</a>,{" "}
            <a href="/wps-payroll-software-uae">WPS payroll software</a> and{" "}
            <a href="/construction-invoicing-software-uae">VAT invoicing software</a>, or the whole platform as a{" "}
            <a href="/manpower-erp-uae">manpower ERP</a>. Plans and prices are on the <a href="/pricing">pricing page</a>.
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
        title="Bring your workbook. See it run."
        lead="A 30-minute call with your own timesheet workbook is all it takes."
      />
    </ContentShell>
  );
}
