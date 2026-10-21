import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "final-settlement-uae-labour-law")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

export const metadata: Metadata = finishMetadata({
  title: post.seoTitle ?? post.title,
  description: post.description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: post.seoTitle ?? post.title, description: post.description, url: URL, type: "article" },
});

export default function Page() {
  return (
    <ContentShell>
      <PostLayout post={post}>
        <p>
          A final settlement is the full amount an employee is owed when their employment ends. Gratuity gets most of
          the attention, but it is only one part. For a manpower supplier settling several leavers a month, the
          difficulty is rarely any single figure: it is making sure every component is included, worked out the same
          way each time, and paid on time.
        </p>

        <h2>What a final settlement includes</h2>
        <ul>
          <li><strong>Unpaid wages</strong> up to the last working day, including any overtime already earned.</li>
          <li><strong>End-of-service gratuity</strong>, if the employee has completed at least one year of continuous service. See <a href="/blog/uae-gratuity-rules-eligibility">UAE gratuity rules and eligibility</a>.</li>
          <li><strong>Pay for unused annual leave</strong> that has accrued.</li>
          <li><strong>Notice pay</strong>, where notice was not worked and the contract or law provides for payment in lieu.</li>
          <li><strong>Other contractual dues</strong>, such as an agreed bonus or a return ticket where the contract provides one.</li>
        </ul>
        <p>
          Amounts the employee owes, such as a salary advance or loan, can be deducted where the law and the contract
          allow it. The contract is the source for anything beyond the statutory items, so always read it first.
        </p>

        <h2>How to work it out</h2>
        <ol>
          <li>Confirm the last working day and the contract type.</li>
          <li>Calculate wages owed for the final period from the payroll record.</li>
          <li>Calculate gratuity from the last basic salary and the length of service, using the <a href="/tools/gratuity-calculator-uae">gratuity calculator</a> or your payroll system.</li>
          <li>Add pay for unused annual leave and any notice pay or contractual dues.</li>
          <li>Subtract valid deductions, then write the whole thing up as a settlement statement.</li>
        </ol>

        <h2>An illustrative example</h2>
        <p>
          These figures are an example only. An employee on a basic salary of AED 3,000 a month (AED 100 a day) leaves
          after five years with 10 days of accrued leave and an outstanding advance of AED 500:
        </p>
        <table>
          <thead>
            <tr><th>Item</th><th>Working</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr><td>Gratuity</td><td>5 years × 21 days × AED 100</td><td>AED 10,500</td></tr>
            <tr><td>Unused leave</td><td>10 days × AED 100</td><td>AED 1,000</td></tr>
            <tr><td>Advance repaid</td><td>Deduction</td><td>&minus; AED 500</td></tr>
            <tr><td><strong>Total, before final wages</strong></td><td></td><td><strong>AED 11,000</strong></td></tr>
          </tbody>
        </table>
        <p>
          The final period&rsquo;s wages come on top, and the day rate for leave should follow the contract, so check
          it before relying on a figure like this.
        </p>

        <h2>When it must be paid</h2>
        <p>
          The settlement is due within 14 days of the employee&rsquo;s last working day. That is a short window, which is
          why the gratuity and leave balances should already be known before someone leaves, not worked out from
          scratch afterwards.
        </p>

        <h2>What to keep on file</h2>
        <ul>
          <li>A signed settlement statement showing each item and the total.</li>
          <li>The payslips and wage records the figures came from.</li>
          <li>The contract, join date and any service gaps.</li>
          <li>Proof of payment.</li>
        </ul>
        <p>
          If the amount is ever disputed, the matter normally starts with MOHRE, which will ask for exactly these
          records.
        </p>

        <h2>Doing it consistently at scale</h2>
        <p>
          Holding basic salary, join date, leave balance and any loans on the same employee record as payroll turns a
          final settlement from a manual rebuild into a statement the system can produce. See how{" "}
          <a href="/wps-payroll-software-uae">WPS payroll software</a> handles loans, gratuity and the monthly bank file,
          and how <a href="/blog/uae-overtime-rules-construction-workers">UAE overtime rules</a> feed the wages part of the
          settlement.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
