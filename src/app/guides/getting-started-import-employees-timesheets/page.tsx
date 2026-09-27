import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { GuideLayout } from "../guide-layout";
import { GUIDES } from "../guides-data";

const guide = GUIDES.find((g) => g.slug === "getting-started-import-employees-timesheets")!;
const URL = `https://manpowersync.com/guides/${guide.slug}`;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: guide.title, description: guide.description, url: URL, type: "article" },
};

export default function Page() {
  return (
    <ContentShell>
      <GuideLayout guide={guide}>
        <p>
          Nothing has to be re-typed to get your workforce and your current month&rsquo;s hours into
          the system — both start from the files you already have.
        </p>

        <h2>1. Import your employees</h2>
        <p>From the Employees list, use the bulk import to bring in your existing roster from a spreadsheet with columns for:</p>
        <ul>
          <li><strong>Employee ID No.</strong> and <strong>Full name</strong> (required for every row)</li>
          <li><strong>Category</strong> &mdash; &ldquo;Site Staff&rdquo; or &ldquo;Staff&rdquo;, which decides whether the row gets a trade or a designation and department</li>
          <li>Trade or Position, Department, Nationality, Passport number, Emirates ID, Mobile number</li>
        </ul>
        <p>
          Each row either creates a new employee or updates an existing one matched by Employee ID
          No. &mdash; so re-uploading a corrected file after fixing a few rows doesn&rsquo;t create
          duplicates, it just updates what changed.
        </p>
        <p>
          For a single new hire, use &ldquo;Add employee&rdquo; instead &mdash; it walks through
          identity, document numbers and expiry dates, deployment and salary in one guided form,
          including scanning a passport or Emirates ID to fill several fields automatically.
        </p>

        <h2>2. Bring in your current timesheet workbook</h2>
        <p>
          On the Timesheets side, upload the consolidated Excel workbook your sites already send in
          &mdash; each month&rsquo;s tab is detected automatically and reconciled against your
          employee list by Employee ID No. If a corrected version of the same file needs to go back
          in, re-uploading it updates that month&rsquo;s figures instead of adding duplicate rows.
        </p>
        <p>
          Sites without a workbook can have hours entered manually instead, and subcontractor crews
          can submit their own hours through the supplier portal &mdash; all three paths land in the
          same approval queue.
        </p>

        <h2>3. Approve, then everything downstream follows</h2>
        <p>
          Once hours are approved, they&rsquo;re what payroll and client invoices are generated from
          &mdash; there&rsquo;s no separate step to re-enter the same hours for billing once they&rsquo;ve
          already been approved for payroll, or the other way around.
        </p>
      </GuideLayout>
    </ContentShell>
  );
}
