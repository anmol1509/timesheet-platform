import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { GuideLayout } from "../guide-layout";
import { GUIDES } from "../guides-data";

const guide = GUIDES.find((g) => g.slug === "run-payroll-export-wps-file")!;
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
        <h2>1. Set each employee&rsquo;s pay structure</h2>
        <p>On an employee&rsquo;s record, choose how they&rsquo;re paid:</p>
        <ul>
          <li><strong>Itemised</strong> &mdash; basic salary plus housing, food, transport and other allowances, each tracked separately.</li>
          <li><strong>Flat</strong> &mdash; one monthly rate.</li>
          <li><strong>Hourly</strong> &mdash; a rate per normal hour worked (site staff only &mdash; office/corporate staff are always paid a fixed monthly salary).</li>
        </ul>
        <p>
          Overtime is calculated on top automatically, at basic-or-flat &divide; 240 &times; the
          multiplier for itemised and flat pay, or the hourly rate &times; the multiplier for hourly
          pay &mdash; whichever structure is set, the same rule applies every month without
          recalculating it by hand.
        </p>

        <h2>2. Create a payroll run</h2>
        <p>
          Starting a run pulls in every employee&rsquo;s approved hours, absence and overtime for the
          month and calculates each line automatically. Anyone whose pay data is incomplete &mdash;
          no bank details, no pay structure set &mdash; is flagged before the run, not after.
        </p>

        <h2>3. Approval and the four-eyes check</h2>
        <p>
          A branch can set a payroll approval threshold &mdash; above that total, the person who
          created the run can&rsquo;t also approve it. A second person has to sign off, and the whole
          decision is written to the audit log.
        </p>

        <h2>4. Export the WPS file</h2>
        <p>
          Once approved, the run exports a Salary Information File (SIF) built from each employee&rsquo;s
          bank and routing details already on their record &mdash; ready to upload to your bank or
          exchange house. Because those details live on the employee record rather than being
          re-typed each month, the most common causes of a rejected file (a mismatched IBAN, a stale
          labour card number) are far less likely to slip in.
        </p>
      </GuideLayout>
    </ContentShell>
  );
}
