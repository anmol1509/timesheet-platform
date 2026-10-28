import type { Metadata } from "next";
import { BadgeCheck, Banknote, FileCheck2, History, Layers, Smartphone, ShieldCheck } from "lucide-react";
import { postsForPillar } from "@/app/(marketing)/blog/clusters";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { SITE } from "@/app/(marketing)/welcome/content";
import {
  Annotated,
  Band,
  BeforeAfter,
  Bento,
  CodeCard,
  Faq,
  LinkCards,
  Peek,
  ProofStrip,
  SectionHead,
  ShowcaseHero,
  ShowcaseCta,
  ShowcaseRoot,
  Step,
  Steps,
  Tile,
  tileParts as T,
} from "@/app/(marketing)/welcome/showcase/showcase";

const TITLE = "WPS Payroll Software for UAE Suppliers";
const DESCRIPTION =
  "Run payroll for hundreds of workers from approved hours, apply overtime, loans and gratuity automatically, and export a bank-ready WPS SIF file every month.";
const URL = "https://manpowersync.com/wps-payroll-software-uae";

export const metadata: Metadata = finishMetadata({
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "WPS payroll software UAE",
    "WPS SIF software",
    "SIF file generator UAE",
    "payroll software Dubai manpower",
    "manpower payroll UAE",
  ],
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: "article" },
});

const PAGE_FAQS = [
  { q: "Where does the WPS file get its bank details?", a: "The salary file is built from each employee's stored bank and routing details and the approved payroll run, so nothing is retyped each month. It can be exported again for a run if you need it." },
  { q: "Which pay structures does payroll support?", a: "Itemised (basic plus allowances), flat monthly and hourly, with overtime and rest-day premiums applied automatically, plus recurring loan deductions and end-of-service gratuity." },
  { q: "Can the person who creates a payroll run also approve it?", a: "Above a set approval threshold, no. A four-eyes rule stops a run being approved by the person who created it, and every figure and change is written to the audit log." },
] as const;

// The opening lines of a real file exported from the product's demo data (sample figures, not a real company).
const SIF_LINES = [
  { kind: "EDR", text: ",17395208112895,302420101,AE210247672661146149039,2026-09-01,2026-09-30,30,1450.00,150.00,2" },
  { kind: "EDR", text: ",17114994887262,309020101,AE770901753264533355832,2026-09-01,2026-09-30,30,1350.00,212.50,1" },
  { kind: "gap", text: "… 32 more employee records" },
  { kind: "SCR", text: ",0000123,302620101,2026-10-21,0442,092026,34,64752.97,AED,AE900261012345678901234" },
] as const;

const shot = (src: string, width: number, height: number, alt: string) => ({ src: `/brand-assets/${src}`, width, height, alt });

export default function WpsPayrollSoftwarePage() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(PAGE_FAQS)} />
      <ShowcaseRoot>
        <ShowcaseHero
          pill="Payroll & WPS"
          pillIcon={<Banknote size={14} aria-hidden />}
          title={
            <>
              <em>WPS payroll software</em> for UAE manpower suppliers
            </>
          }
          lead="From approved hours to a bank-ready WPS file, with overtime, loans and gratuity worked out the same way every month."
          ticks={["Itemised, flat or hourly pay", "Four-eyes approval above your limit", "A SIF file built from stored bank details"]}
          secondaryCta={{ href: "/tools/wps-sif-file-checker", label: "Try the free SIF checker" }}
          image={shot("wps-run-main.webp", 1400, 1085, "An approved September payroll run in ManpowerSync: AED 64,752.97 net for 34 employees, the four steps from review to pay, and the Bank file (WPS) button.")}
          badge={{ icon: <BadgeCheck size={18} aria-hidden />, title: "Approved by a second person", sub: "Four-eyes check passed" }}
          slice={{
            label: "Payroll · September 2026",
            amount: "AED 64,752.97",
            meta: "34 employees · WPS file ready",
            steps: [
              { name: "Review", state: "done" },
              { name: "Submit", state: "done" },
              { name: "Approve", state: "done" },
              { name: "Pay", state: "now" },
            ],
            button: "Bank file (WPS)",
          }}
        />

        <ProofStrip
          items={[
            { value: "3", label: "pay structures: itemised, flat or hourly" },
            { value: "4", label: "steps from hours to bank: review, submit, approve, pay" },
            { value: "1", label: "file for your bank, built from the approved run" },
            { value: "100%", label: "of figures and changes recorded in the audit log" },
          ]}
        />

        <Band>
          <SectionHead
            eyebrow="How a payroll month runs"
            title="Four steps from approved hours to paid."
            lead="Payroll for a workforce paid monthly, through WPS: every figure is calculated the same way, checked before money moves, and exported for the bank."
          />
          <Steps>
            <Step n={1} title="Hours come in" body="Payroll runs from approved hours, with each employee's pay structure applied. Overtime, rest-day premiums and absences are worked out from the record, day by day.">
              <Peek {...shot("wps-days.webp", 1100, 885, "Day-by-day pay for one worker: salary for the days, overtime hours and absence, with each day's total and the net pay for the month.")} />
            </Step>
            <Step n={2} title="Review the run" body="See the total, the headcount and anyone left out before anything moves. A missing bank detail is flagged so you can fix it and rebuild the run.">
              <Peek top {...shot("wps-run-main.webp", 1400, 1085, "The payroll run page showing total net pay, employee count and the review, submit, approve and pay steps.")} />
            </Step>
            <Step n={3} title="A second person approves" body="Above your approval limit the person who created the run can't approve it. The decision, and every change behind it, is written to the audit log.">
              <Peek {...shot("wps-approval.webp", 694, 390, "The approvals inbox showing a payroll run of AED 64,752.97 waiting for a decision, with Send back and Approve buttons.")} />
            </Step>
            <Step n={4} title="Export the bank file" body="Download the WPS salary file built from each employee's stored bank and routing details, upload it to your bank or exchange house, then mark the run paid.">
              <CodeCard inStep label="The first lines of a WPS SIF file: employee records followed by one control record with the count and total." lines={[...SIF_LINES]} />
            </Step>
          </Steps>
        </Band>

        <Band soft>
          <SectionHead
            eyebrow="Built for monthly WPS runs"
            title="Everything payroll needs, in one place."
            lead="A SIF file your bank actually accepts, pay rules applied consistently, and a paper trail for every change."
          />
          <Bento>
            <Tile tone="dark" span2 row2 icon={<FileCheck2 size={22} aria-hidden />} title="A SIF file your bank actually accepts" body="Bank and routing details, labour card numbers and salary figures come straight from the employee record used every month, not re-typed into a fresh spreadsheet each time. That's the single biggest cause of a rejected file.">
              <T.List items={["One line per employee, plus one control record", "The control total ties to the lines, to the fils", "Re-exportable for the run whenever you need it"]} />
              <T.Verdict title="Checked: no errors found" body="34 employee records, and the AED 64,752.97 control total ties to the lines. Try it on your own file with the free SIF checker." href="/tools/wps-sif-file-checker" />
              <T.Media>
                <CodeCard label="A WPS SIF file: two employee records and the control record." lines={[...SIF_LINES]} />
              </T.Media>
            </Tile>
            <Tile tone="tint" span2 icon={<Layers size={22} aria-hidden />} title="Pay structures that fit the roster" body="Itemised (basic plus allowances), flat monthly or hourly, with overtime and rest-day premiums applied on top automatically.">
              <T.Chips items={["Itemised", "Flat monthly", "Hourly", "Overtime multipliers"]} />
            </Tile>
            <Tile tone="sky" icon={<Banknote size={22} aria-hidden />} title="Overtime, loans and gratuity" body="Calculated the same way every time.">
              <T.List items={["Overtime multipliers", "Recurring loan deductions", "End-of-service gratuity"]} />
            </Tile>
            <Tile tone="violet" icon={<Smartphone size={22} aria-hidden />} title="Payslips on any phone" body="Workers open their own payslip in a browser.">
              <T.Media>
                <T.Zoom {...shot("wps-payslip.webp", 900, 693, "A monthly payslip showing basic salary, allowances, overtime, total earnings and net pay.")} />
              </T.Media>
            </Tile>
            <Tile span2 icon={<ShieldCheck size={22} aria-hidden />} title="Approval limits and a four-eyes check before money moves" body="A payroll run above a set threshold can't be approved by the same person who created it, so a payroll error is caught before the transfer, not after.">
              <T.Media>
                <T.Img fade {...shot("wps-approval.webp", 694, 390, "The approvals inbox with a payroll run waiting for a second person's decision.")} />
              </T.Media>
            </Tile>
            <Tile span2 icon={<History size={22} aria-hidden />} title="A complete audit trail" body="Approval thresholds, a four-eyes rule above them, and a record of who changed what and when.">
              <T.Log
                items={[
                  { what: "Payroll run created for September", who: "Prepared from attendance" },
                  { what: "Submitted for approval", who: "Sent to the approvals inbox" },
                  { what: "Approved by a second person", who: "Releases the run for payment" },
                  { what: "WPS file exported", who: "Re-exportable for this run" },
                ]}
              />
            </Tile>
          </Bento>
        </Band>

        <Band>
          <SectionHead
            eyebrow="See it"
            title="One screen to check and release the month."
            lead="Everything you need to approve and pay is on the run page: the total, who's in it, where you are in the process, and the bank file."
          />
          <Annotated
            image={shot("wps-run-main.webp", 1400, 1085, "The approved payroll run page, with the total net pay, the four process steps and the Bank file (WPS) button marked.")}
            pins={[
              { n: 1, left: 33, top: 33 },
              { n: 2, left: 80, top: 54 },
              { n: 3, left: 31, top: 65 },
            ]}
            legend={[
              { title: "The total and who's in it", body: "Net pay, headcount and anyone left out, before you submit." },
              { title: "Where the run stands", body: "Review, submit, approve, pay: the next step is always clear." },
              { title: "The bank file and payslips", body: "Download the WPS file for your bank, then mark the run as paid." },
            ]}
          />
        </Band>

        <Band soft>
          <SectionHead eyebrow="Before and after" title="Payroll without the monthly scramble." />
          <BeforeAfter
            before={{
              tag: "Payroll in a spreadsheet",
              title: "Rebuilt and rechecked every month",
              items: [
                "Bank details retyped into a fresh file each month",
                "Overtime formulas that break when a sheet is copied",
                "A control total that's out by a fils, so the file is rejected",
                "One person who understands the workbook",
                "No record of who changed a figure",
              ],
            }}
            after={{
              tag: "With ManpowerSync",
              title: "Calculated once, from the record",
              items: [
                "Bank details come from the employee record",
                "Pay rules applied the same way for every worker",
                "The file's total ties to the approved run",
                "Anyone with access can review the run",
                "Every figure and change in the audit log",
              ],
            }}
          />
          <p style={{ margin: "28px 0 0", textAlign: "center", fontSize: 16, color: "var(--slate)" }}>
            Already have a file? Check it with the <a href="/tools/wps-sif-file-checker" style={{ fontWeight: 600, color: "var(--primary)" }}>free WPS SIF file checker</a>, or see{" "}
            <a href="/compare/manpowersync-vs-excel" style={{ fontWeight: 600, color: "var(--primary)" }}>ManpowerSync vs Excel</a>.
          </p>
        </Band>
      </ShowcaseRoot>

      <ShowcaseRoot>
        <Band>
          <SectionHead eyebrow="Connected modules" title="Where the hours come from, and where they go." />
          <LinkCards
            cards={[
              { href: "/timesheet-software-construction-uae", title: "Timesheet software", body: "Where the approved hours payroll runs from actually come from: Excel, manual entry or supplier submissions." },
              { href: "/construction-invoicing-software-uae", title: "Billing & VAT invoicing", body: "The same approved hours, turned into VAT-ready client invoices instead of a second spreadsheet." },
              { href: "/tools/gratuity-calculator-uae", title: "UAE gratuity calculator", body: "The end-of-service figure for any leaver, with the working shown. Payroll applies the same formula automatically." },
              { href: "/blog/wps-sif-rejection-reasons-uae", title: "Why SIF files get rejected", body: "The most common reasons a WPS salary file bounces back, and how to stop them recurring every month." },
            ]}
          />
        </Band>

        <Band soft>
          <SectionHead eyebrow="Further reading" title="Guides behind this topic." />
          <LinkCards cards={postsForPillar("/wps-payroll-software-uae").map((p) => ({ href: `/blog/${p.slug}`, title: p.title, body: p.description }))} />
        </Band>

        <Band>
          <SectionHead eyebrow="FAQ" title="Questions, answered." />
          <Faq items={PAGE_FAQS} />
        </Band>

        <ShowcaseCta
          title={`Run this month's payroll on ${SITE.name}.`}
          lead="Bring your employees' bank details as they stand today. Nothing to re-key before your first run."
        />
      </ShowcaseRoot>
    </ContentShell>
  );
}
