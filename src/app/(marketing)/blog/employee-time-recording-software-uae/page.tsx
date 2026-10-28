import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "employee-time-recording-software-uae")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

const SEO_TITLE = "Employee Time Recording Software: UAE Buyer's Guide";

const FAQS = [
  {
    q: "What is employee time recording software?",
    a: "Software that records when each employee starts and stops work, and turns those records into hours you can approve, pay and bill. At its simplest it replaces a paper register or a spreadsheet. At its most useful it feeds payroll and client invoices from the same record.",
  },
  {
    q: "What is the difference between time recording and time tracking?",
    a: "In practice the terms overlap. Time recording usually means keeping an accurate record of hours worked for payroll and compliance. Time tracking often means following time against tasks or projects. Most tools do both, so judge them on the features you need rather than the label.",
  },
  {
    q: "How do I record time for workers on different sites?",
    a: "Record attendance against each worker's unique ID and the project or site they worked on, rather than keeping one sheet per site. That way a worker who moves between sites is never double counted, and hours can be totalled by worker, by site or by client.",
  },
  {
    q: "Is a spreadsheet enough to record employee time?",
    a: "For a small team it can be. It starts to fail when several people edit copies, when hours need approval, or when the same hours must feed payroll and a client invoice. At that point a system with one shared record saves more time than it costs.",
  },
  {
    q: "Should recorded hours be editable after approval?",
    a: "No. Once hours are approved they should lock, so payroll and the invoice match what was approved. Any later correction should be a visible change with a reason, not a silent edit.",
  },
] as const;

export const metadata: Metadata = finishMetadata({
  title: { absolute: SEO_TITLE },
  description: post.description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: SEO_TITLE, description: post.description, url: URL, type: "article" },
});

export default function Page() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(FAQS)} />
      <PostLayout post={post}>
        <p>
          Employee time recording software keeps a reliable record of who worked, where and for how long. For a
          small office that can be a punch clock. For a UAE manpower supplier with hundreds of workers across
          several clients, the same record has to feed payroll, overtime, WPS and client invoices, and it has
          to survive a dispute. This guide explains what to expect from time recording software and how to choose.
        </p>

        <h2>What employee time recording software should record</h2>
        <ul>
          <li><strong>Who:</strong> a unique worker ID, not just a name, so two people with similar names are never merged.</li>
          <li><strong>When:</strong> the date and the hours worked, or the clock-in and clock-out times.</li>
          <li><strong>Where:</strong> the project, site or client the hours belong to.</li>
          <li><strong>What kind of hours:</strong> normal, overtime, night and rest-day hours, since each is paid differently.</li>
          <li><strong>Who approved it, and when:</strong> so the hours can be defended later.</li>
        </ul>

        <h2>The ways time gets recorded</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Works well when</th>
                <th>Weak spot</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Paper register</td><td>Very small teams on one site</td><td>Re-keying, lost sheets, no audit trail</td></tr>
              <tr><td>Excel or Google Sheets</td><td>A few workers and one client</td><td>Many versions of one file, manual totals</td></tr>
              <tr><td>Clock-in app or web clock</td><td>Employees who clock themselves in</td><td>Needs a phone each and trust that the right person clocks in</td></tr>
              <tr><td>Biometric or access device</td><td>Fixed sites with a gate or office</td><td>Hardware cost, and nothing at moving sites</td></tr>
              <tr><td>Supplier or supervisor submissions</td><td>Workforces supplied through several companies</td><td>Needs approval steps to be trusted</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Many workforces use a mix. What matters is that every method ends up in the same record, with the same
          worker IDs, instead of living in separate files.
        </p>

        <h2>Features that matter most</h2>
        <h3>One record that feeds payroll and billing</h3>
        <p>
          If the hours are typed again into a payroll sheet and again into an invoice, errors appear at each step. Look
          for software where approved hours flow straight into{" "}
          <a href="/wps-payroll-software-uae">WPS payroll</a> and{" "}
          <a href="/construction-invoicing-software-uae">client invoices</a>.
        </p>
        <h3>Overtime and shift rules</h3>
        <p>
          Overtime, night-shift and rest-day pay should be applied by rule, not by whoever is typing. See{" "}
          <a href="/blog/uae-overtime-rules-construction-workers">UAE overtime rules for construction workers</a> for
          what the rules need to cover.
        </p>
        <h3>Approval and locking</h3>
        <p>
          A supervisor or client approves the hours, and approved hours lock. Corrections after that are visible changes
          with a reason. This is what stops a total from drifting between payroll and the invoice.
        </p>
        <h3>Multiple sites, clients and suppliers</h3>
        <p>
          If workers move between projects, or come from several supplier companies, the system must handle that
          without copying files. Look at <a href="/timesheet-software-construction-uae">timesheet software built for
          UAE construction and manpower teams</a>.
        </p>
        <h3>Exports and a clear record</h3>
        <p>
          You should be able to export hours and print a client-ready timesheet in the layout the client expects. The{" "}
          <a href="/blog/construction-timesheet-format-labour-supply-uae">construction timesheet format guide</a> shows
          what clients look for.
        </p>

        <h2>Questions to ask before you buy</h2>
        <ol>
          <li>Can we import our current attendance files, or must we re-enter everything?</li>
          <li>Do the same approved hours feed payroll and client invoices?</li>
          <li>What happens to hours after they are approved? Can anyone edit them?</li>
          <li>How are overtime, night and rest-day hours worked out, and can we change the rules?</li>
          <li>Can a worker be on different projects in one month without being counted twice?</li>
          <li>Where is our data held, and can we export all of it if we leave?</li>
          <li>What does it cost at our headcount, not just per user?</li>
        </ol>

        <h2>A free place to start</h2>
        <p>
          If you only need a personal record of hours today, the{" "}
          <a href="/tools/free-online-time-clock">free online time clock</a> and the{" "}
          <a href="/tools/construction-timesheet-template">free labour supply timesheet template</a> cost nothing. When
          you need approvals, payroll and invoices from one record, that is the point to move to a system.
        </p>

        <h2>Frequently asked questions</h2>
        {FAQS.map((f) => (
          <div key={f.q}>
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </PostLayout>
    </ContentShell>
  );
}
