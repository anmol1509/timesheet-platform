import { Landmark } from "lucide-react";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ToolPage } from "../tool-page";
import type { Metadata } from "next";
import { faqLd, webApplicationLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import { IbanValidator } from "./iban-validator";

const tool = TOOLS.find((t) => t.slug === "uae-iban-validator")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["UAE IBAN validator", "IBAN checker UAE", "validate AE IBAN", "UAE IBAN format", "WPS IBAN check"],
  alternates: { canonical: `${SITE_URL}${PATH}` },
});

const FAQS = [
  { q: "How many characters is a UAE IBAN?", a: "23. It starts with AE, followed by two check digits, a 3-digit bank code and a 16-digit account number. After the letters AE it is digits only." },
  { q: "Does a valid IBAN mean the account exists?", a: "No. The check confirms the number is correctly formed and that its check digits match, which catches typing mistakes. It cannot tell whether the account is open or belongs to a particular person." },
  { q: "Why does an IBAN problem matter for WPS?", a: "Each salary record in a WPS file carries the employee's account. A malformed IBAN is one of the most common reasons a record, or the whole file, is rejected, so it is worth checking before the file goes to the bank." },
  { q: "Can I check many IBANs at once?", a: "Yes. Paste a list, one IBAN per line, into the box below the single check, for example a column copied from your payroll sheet." },
  { q: "Is the IBAN I type sent anywhere?", a: "No. The check runs in your browser and nothing is uploaded or stored." },
] as const;

export default function IbanValidatorPage() {
  return (
    <ToolPage
      slug="uae-iban-validator"
      accent={ACCENTS.blue}
      hero={{
        pill: "Free tool",
        pillIcon: <Landmark size={14} aria-hidden />,
        title: <>UAE <em>IBAN validator</em></>,
        lead: "Check a UAE IBAN in a second, see exactly what is wrong if it is not valid, or check a whole payroll column at once.",
        badges: ["Free, no sign-up", "Checked in your browser", "Bulk check a whole list"],
      }}
      ld={[webApplicationLd({ path: PATH, name: tool.title, description: tool.description, category: "FinanceApplication" }), faqLd(FAQS)]}
      tool={<IbanValidator />}
      how={[
        { title: "Type or paste", body: "One IBAN, or a whole column from your payroll sheet." },
{ title: "Instant result", body: "Length, AE format and check digits, with the exact mistake." },
{ title: "Fix before the bank sees it", body: "Correct bad IBANs before the salary file is uploaded." },
      ]}
      article={
        <>
          <h2>What a UAE IBAN looks like</h2>
          <p>A UAE IBAN is always 23 characters:</p>
          <table>
            <thead>
              <tr><th>Part</th><th>Length</th><th>Example</th></tr>
            </thead>
            <tbody>
              <tr><td>Country code</td><td>2</td><td>AE</td></tr>
              <tr><td>Check digits</td><td>2</td><td>07</td></tr>
              <tr><td>Bank code</td><td>3</td><td>033</td></tr>
              <tr><td>Account number</td><td>16</td><td>1234567890123456</td></tr>
            </tbody>
          </table>
          <p>Written in groups of four it reads <strong>AE07 0331 2345 6789 0123 456</strong>. That one is a made-up example from the IBAN specification, not a real account.</p>

          <h2>The mistakes this catches</h2>
          <ul>
            <li><strong>A missing or extra digit.</strong> Common when an IBAN is retyped from a photo or a WhatsApp message.</li>
            <li><strong>The letter O for zero</strong> (or I for 1). After AE, everything must be a digit.</li>
            <li><strong>Swapped or mistyped digits.</strong> The check digits are calculated from the rest of the number, so a single wrong digit or two swapped neighbours fails.</li>
            <li><strong>Spaces, dashes and symbols</strong> pasted in from a document. They are ignored here but must not be in the salary file.</li>
            <li><strong>A non-UAE IBAN</strong> on an employee record that needs a local account.</li>
          </ul>

          <h2>Why check before the salary file goes to the bank</h2>
          <p>
            Every employee record in a WPS file carries an account, and one that is malformed can get a record or the whole file bounced, with workers waiting to be paid. Checking the IBANs first takes a minute.
            Read <a href="/blog/wps-sif-rejection-reasons-uae">why WPS SIF files get rejected</a> for the other common causes,
            and run the finished file through the <a href="/tools/wps-sif-file-checker">WPS SIF file checker</a>.
          </p>
          <p>
            Better still, keep each worker&rsquo;s bank details on one employee record and build the file from it, so
            nothing is retyped. That is how <a href="/wps-payroll-software-uae">WPS payroll software</a> avoids the problem.
          </p>
        </>
      }
      next={{ title: "Stop retyping bank details every month.", body: "Keep each worker's bank details on one employee record and build the WPS file from it, so there is nothing to retype or mistype.", href: "/wps-payroll-software-uae", label: "See WPS payroll software" }}
      faqs={FAQS}
    />
  );
}
