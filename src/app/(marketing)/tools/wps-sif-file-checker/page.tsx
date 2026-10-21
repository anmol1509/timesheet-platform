import { FileCheck2 } from "lucide-react";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ToolPage } from "../tool-page";
import type { Metadata } from "next";
import { faqLd, webApplicationLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import { SifChecker } from "./sif-checker";

const tool = TOOLS.find((t) => t.slug === "wps-sif-file-checker")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["WPS SIF file checker", "SIF file validator UAE", "WPS file rejected", "SIF file format", "WPS file error check"],
  alternates: { canonical: `${SITE_URL}${PATH}` },
});

const FAQS = [
  { q: "What is a SIF file?", a: "The Salary Information File that a UAE employer uploads to its bank or exchange house to pay salaries through the Wage Protection System. It has one EDR record per employee and one SCR control record with the totals." },
  { q: "What do EDR and SCR mean?", a: "EDR is the employee detail record: one line per paid worker with their ID, routing code, account, pay period, days, fixed and variable pay, and leave days. SCR is the salary control record: one line with the establishment, file date, salary month, the number of employees, the total and the payer's account." },
  { q: "Will a clean result guarantee my bank accepts the file?", a: "No. This checks the structure and arithmetic of the file for the mistakes that commonly cause rejections. Banks and exchange houses apply their own rules and check records against MOHRE, so use their test or validation mode as well." },
  { q: "Why does a difference of one fils matter?", a: "The control total must equal the sum of every employee's fixed and variable pay exactly. A rounding difference of 0.01 anywhere is enough for the whole file to be rejected, not just that line." },
  { q: "Is my salary file uploaded?", a: "No. The file is read and checked in your browser and nothing is sent to us or stored." },
] as const;

export default function SifCheckerPage() {
  return (
    <ToolPage
      slug="wps-sif-file-checker"
      accent={ACCENTS.mint}
      hero={{
        pill: "Free tool",
        pillIcon: <FileCheck2 size={14} aria-hidden />,
        title: <>WPS <em>SIF file checker</em></>,
        lead: "Find the problems in a UAE salary file before your bank does: totals that do not tie, bad IBANs, duplicate IDs, malformed dates and more.",
        badges: ["Free, no sign-up", "Checked in your browser", "Nothing uploaded or stored"],
      }}
      ld={[webApplicationLd({ path: PATH, name: tool.title, description: tool.description, category: "FinanceApplication" }), faqLd(FAQS)]}
      tool={<SifChecker />}
      how={[
        { title: "Paste or upload", body: "Drop in your .SIF file, or paste its lines." },
{ title: "See what's wrong", body: "Totals, IBANs, dates and IDs checked line by line." },
{ title: "Fix and re-check", body: "Correct the file and run it again until it's clean." },
      ]}
      article={
        <>
          <h2>What the checker looks at</h2>
          <ul>
            <li><strong>The control record.</strong> Exactly one SCR line, with the right number of fields, a valid date, time and salary month (MMYYYY), AED as the currency, and a valid payer IBAN.</li>
            <li><strong>The count and total.</strong> The employee count must match the number of EDR lines, and the control total must equal the sum of every line&rsquo;s fixed and variable pay to the fils.</li>
            <li><strong>Each employee line.</strong> 10 fields, a numeric employee ID, a 9-digit routing code, a valid IBAN, real calendar dates, a sensible number of days, amounts written as numbers with two decimals, and no negatives.</li>
            <li><strong>Duplicates and stray spaces.</strong> The same employee ID twice, or spaces around a value, which are invisible but break the match.</li>
            <li><strong>The file name</strong>, if you upload one: the .SIF extension and the establishment ID at the start.</li>
          </ul>

          <h2>What it can&rsquo;t check</h2>
          <p>
            It cannot know whether an account exists, whether a labour card is current, or what your bank&rsquo;s own rules are. Records are also checked
            against MOHRE&rsquo;s data, which is the category of rejection that is hardest to catch by eye. Use your bank&rsquo;s validation mode for the final word.
          </p>

          <h2>Fixing the usual suspects</h2>
          <ul>
            <li><strong>Total does not match:</strong> recalculate it from the lines, and look for a rounding difference in overtime or a deduction.</li>
            <li><strong>Invalid IBAN:</strong> retype it from the source and check it with the <a href="/tools/uae-iban-validator">UAE IBAN validator</a>.</li>
            <li><strong>Duplicate or short employee ID:</strong> an extra or missing leading zero is the usual cause. Copy the ID from the labour card.</li>
            <li><strong>Extra comma:</strong> a thousands separator such as 2,000.00 adds a field. Amounts must have no separators.</li>
          </ul>
          <p>
            The causes are covered in more detail in <a href="/blog/wps-sif-rejection-reasons-uae">why your WPS SIF file gets rejected</a>.
            If you build the file by hand every month, <a href="/wps-payroll-software-uae">WPS payroll software</a> generates it from the
            stored bank details of each employee and approved payroll, so these errors can&rsquo;t creep in, and the guide to{" "}
            <a href="/guides/run-payroll-export-wps-file">running payroll and exporting a WPS file</a> shows how.
          </p>
        </>
      }
      next={{ title: "Never build a SIF file by hand again.", body: "WPS payroll software exports the file from approved payroll and each employee's stored bank details, so the totals tie by construction.", href: "/wps-payroll-software-uae", label: "See WPS payroll software" }}
      faqs={FAQS}
    />
  );
}
