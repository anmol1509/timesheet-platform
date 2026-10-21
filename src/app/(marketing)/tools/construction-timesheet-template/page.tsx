import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import p from "@/app/(marketing)/welcome/prose.module.css";
import w from "@/app/(marketing)/welcome/welcome.module.css";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import s from "../calculator.module.css";

const tool = TOOLS.find((t) => t.slug === "construction-timesheet-template")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["construction timesheet template Excel", "labour supply timesheet template", "UAE timesheet format", "manpower timesheet Excel", "monthly timesheet template"],
  alternates: { canonical: `${SITE_URL}${PATH}` },
});

const FAQS = [
  { q: "Is the timesheet template free?", a: "Yes. Download the Excel or PDF version, use it as often as you like, and add your own letterhead." },
  { q: "How do the dates fill in?", a: "Enter the period start and end in the header of the Excel sheet. The day numbers and weekdays for each column fill in, and days beyond the end of the period are left blank, so it works for 28, 30 and 31-day months and for periods that cross a month end." },
  { q: "What do the attendance codes mean?", a: "Type hours worked as a number, or a code: A for absent, W for the weekly off day and H for a public holiday. Hours are added up automatically, absent days are counted, and the codes are colour-coded so a page reads at a glance." },
  { q: "Does it calculate the invoice totals?", a: "The second sheet multiplies hours by rate for each trade and project, adds any allowed additions or deductions, applies VAT (5% by default, editable) and shows the net amount payable. Check the rates and VAT treatment against your contract." },
  { q: "Can I change the layout?", a: "Yes. It is an ordinary Excel file with no locked cells, so add columns, rename the codes or put your logo in the header." },
] as const;

export default function TimesheetTemplatePage() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(FAQS)} />
      <PageHero
        eyebrow="Free template"
        title="Labour supply timesheet template"
        lead="A client-ready monthly timesheet for construction and manpower supply in the UAE: roster, attendance codes, trade summary and three sign-offs, in Excel and PDF."
        cta={false}
      />

      <Section>
        <div className={p.prose}>
          <h2>Download</h2>
          <p>
            The Excel version fills in dates and weekdays from the period you enter and adds up hours, absences and
            amounts for you. The PDF is a blank to print and fill in by hand on site.
          </p>
        </div>
        {/* Outside .prose so the article link styling doesn't restyle the buttons. */}
        <div className={s.downloads} style={{ maxWidth: 720, margin: "22px auto 0" }}>
          <a href="/tools/construction-timesheet-template/download/xlsx" download className={`${w.btn} ${w.btnPrimary} ${w.btnLg}`}>
            Download Excel (.xlsx)
          </a>
          <a href="/tools/construction-timesheet-template/download/pdf" download className={`${w.btn} ${w.btnGhost} ${w.btnLg}`}>
            Download PDF (print)
          </a>
        </div>
        <div className={p.prose}>
          <h2>What is in it</h2>
          <ul>
            <li><strong>Header:</strong> supplier, client, project or site, the period covered, who prepared it and the client reference or LPO.</li>
            <li><strong>Roster:</strong> one row per worker with ID, name and trade, one column per day with the weekday shown, total hours and absent days.</li>
            <li><strong>Attendance codes with a legend:</strong> hours as numbers, A for absent, W for the weekly off day, H for a public holiday.</li>
            <li><strong>Summary by trade and project:</strong> hours, rate and amount per line, then additions or deductions, VAT and the net payable.</li>
            <li><strong>Sign-off:</strong> prepared, verified and approved blocks with name, signature and date.</li>
            <li><strong>Notes:</strong> submission terms so they are agreed in writing, not argued about later.</li>
          </ul>

          <h2>How to use it</h2>
          <ol>
            <li>Enter the supplier, client, project and the exact period. A timesheet with no clear period is the easiest to dispute.</li>
            <li>List each worker once, with a unique ID, so two people with similar names can never be merged.</li>
            <li>Record hours daily, not at month end, and use the codes for everything that is not a worked day.</li>
            <li>Group the hours by trade and project on the second sheet, using the rate agreed for each.</li>
            <li>Have the preparer, your verifier and the client&rsquo;s representative sign before you invoice, and attach the signed timesheet to the invoice.</li>
          </ol>
          <p>
            The reasoning behind each part is in our guide to the{" "}
            <a href="/blog/construction-timesheet-format-labour-supply-uae">construction timesheet format for labour supply</a>, and{" "}
            <a href="/blog/stop-client-timesheet-disputes-labour-supply-invoices">how to stop client timesheet disputes</a> covers what to agree with the client first.
          </p>

          <h2>When a template is not enough</h2>
          <p>
            A spreadsheet works well for a handful of workers on one project. Once the same hours have to feed payroll, a WPS file and invoices for several
            clients, retyping them into each is where errors and disputes start. See{" "}
            <a href="/timesheet-software-construction-uae">timesheet software for UAE construction and manpower teams</a>,
            where approved hours become the payroll and the invoice without being typed again, or compare{" "}
            <a href="/compare/manpowersync-vs-excel">ManpowerSync with Excel</a>. Working out what rate to put on the summary?
            Try the <a href="/tools/manpower-hourly-rate-calculator">manpower hourly rate calculator</a>.
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
        title="Stop rebuilding this sheet every month."
        lead="ManpowerSync produces the timesheet, the payroll and the invoice from the same approved hours."
      />
    </ContentShell>
  );
}
