import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "uae-gratuity-rules-eligibility")!;
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
          Gratuity, or end-of-service benefit, is the lump sum a private-sector employee in the UAE is owed when
          their employment ends. The formula is fixed by law, so most mistakes come from the rules around it: who
          qualifies, which salary counts, and how much service is counted. This guide covers those rules for UAE labour
          law (also written labor law); to put a figure on a specific case, use the{" "}
          <a href="/tools/gratuity-calculator-uae">UAE gratuity calculator</a>.
        </p>

        <h2>Who is eligible for gratuity</h2>
        <p>
          An employee who has completed at least one full year of continuous service with the same employer is
          entitled to gratuity under Federal Decree-Law No. 33 of 2021. Under one year, nothing accrues. It applies
          whether the contract is limited or unlimited, and whether the employee is full-time or part-time (part-time
          is calculated in proportion).
        </p>

        <h2>What counts as service</h2>
        <p>
          Service is counted from the start date and must be continuous. Periods that do not count, such as unpaid
          leave, shorten the length used, and a real break in employment can reset it. For a supplier, the safest
          approach is to keep the join date, any gaps and the contract type on the employee record, not in a separate
          file that is only opened at exit.
        </p>

        <h2>The rules in one place</h2>
        <ul>
          <li><strong>Base salary:</strong> the last basic salary. Housing, transport and other allowances, commissions and overtime are excluded.</li>
          <li><strong>Rate:</strong> 21 days of basic salary for each of the first five years, and 30 days for each year after that.</li>
          <li><strong>Part years:</strong> counted in proportion.</li>
          <li><strong>Cap:</strong> two years of basic salary in total, however long the service.</li>
          <li><strong>Payment:</strong> within 14 days of the employee&rsquo;s last working day.</li>
        </ul>
        <p>
          A day&rsquo;s basic salary is the monthly basic divided by 30. The{" "}
          <a href="/blog/eosb-gratuity-calculation-uae">full calculation, with the formula and examples</a>, is a separate guide.
        </p>

        <h2>Dubai, Abu Dhabi and the free zones</h2>
        <p>
          For mainland employees the same federal rules apply in every emirate, so gratuity in Dubai is worked out
          the same way as in Abu Dhabi or Sharjah. Free zones can be different. DIFC and ADGM, for example, have their
          own employment rules, and an employer can offer an approved alternative end-of-service scheme instead of the
          lump sum. Check which regime applies before you calculate anything.
        </p>

        <h2>Common mistakes</h2>
        <ul>
          <li>Calculating on gross pay instead of basic salary.</li>
          <li>Counting service that should be excluded, such as unpaid leave.</li>
          <li>Rounding part years up instead of counting them in proportion.</li>
          <li>Forgetting the two-year cap on long-serving employees.</li>
          <li>Working the figure out only after the employee has left, when the 14-day clock is already running.</li>
        </ul>

        <h2>If the figure is disputed</h2>
        <p>
          A disagreement about the amount normally starts with MOHRE, the Ministry of Human Resources and
          Emiratisation, which looks at the contract, the wage record and the service dates. Keeping those three clean
          is the best protection. Gratuity is also one line of a{" "}
          <a href="/blog/final-settlement-uae-labour-law">final settlement</a>, which covers everything else owed on exit.
        </p>

        <h2>Keep it in payroll, not in a spreadsheet at exit</h2>
        <p>
          Gratuity accrues every month, so the cleanest approach is to hold basic salary and join date on the employee
          record and let payroll apply the formula. See how <a href="/wps-payroll-software-uae">WPS payroll software</a>{" "}
          does that, and read why{" "}
          <a href="/blog/wps-sif-rejection-reasons-uae">WPS files get rejected</a> for the other recurring payroll problem.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
