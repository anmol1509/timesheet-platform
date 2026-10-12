import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "construction-timesheet-format-labour-supply-uae")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

const SEO_TITLE = "Construction Timesheet Format for Labour Supply (UAE)";

const FAQS = [
  {
    "q": "What should a construction timesheet include?",
    "a": "The supplier and client names, the project or site, the period covered, and a row for each worker with their ID, name, trade and hours for each day. It should also show total hours, a summary by trade with the agreed rate and amount, and signature lines for the people who prepared, verified and approved it."
  },
  {
    "q": "Why do clients reject manpower supply invoices?",
    "a": "Most rejections come from the timesheet, not the invoice: it is missing, unsigned, covers the wrong period, or its hours do not match the invoice. Attaching a signed timesheet that matches the invoice line by line removes most of them."
  },
  {
    "q": "What do the codes A, W and H mean on a timesheet?",
    "a": "Common codes are A for absent, W for the weekly off day and H for a public holiday, with a number for the hours worked on any other day. Whatever codes you use, print a short legend on the sheet so the client reads them the same way you do."
  },
  {
    "q": "Is Excel good enough for labour supply timesheets?",
    "a": "Excel works for a handful of workers. As headcount and clients grow, copy-pasted hours, different versions of the same file and manual totals create errors that surface as invoice disputes. A system that records attendance once and produces the timesheet from it removes that rework."
  }
];

export const metadata: Metadata = {
  title: { absolute: SEO_TITLE },
  description: post.description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: SEO_TITLE, description: post.description, url: URL, type: "article" },
};

export default function Page() {
  return (
    <ContentShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Article",
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              author: { "@type": "Organization", name: "ManpowerSync" },
              publisher: { "@type": "Organization", name: "ManpowerSync", url: "https://manpowersync.com" },
              mainEntityOfPage: URL,
            },
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
          ]),
        }}
      />
      <PostLayout post={post}>
        <p>
          A manpower supply invoice is only as strong as the timesheet behind it. Clients in
          construction routinely ask for a signed timesheet before they will process an invoice,
          and a timesheet that is missing a column, mixes two projects or does not add up is the
          most common reason an invoice sits unpaid. This guide sets out what a client-ready
          labour supply timesheet should contain and a layout you can copy.
        </p>

        <h2>1. The header: who, where and when</h2>
        <p>
          Put the supplier&rsquo;s name and letterhead at the top, then the name of the company
          being billed, the project or site and the exact period covered, for example 1 to 31 August 2026. A timesheet with no clear period is
          the easiest one for a client to dispute.
        </p>

        <h2>2. The roster: one row per worker, one column per day</h2>
        <p>
          Each row identifies a worker and records their hours day by day. These columns cover what
          clients look for:
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>S#</th>
                <th>ID no.</th>
                <th>Employee name</th>
                <th>Trade</th>
                <th>Total</th>
                <th>1 Sat</th>
                <th>2 Sun</th>
                <th>3 Mon</th>
                <th>&hellip;</th>
                <th>Absent total</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>AA002</td><td>Worker one</td><td>Mason</td><td>217</td><td>7</td><td>W</td><td>10</td><td>&hellip;</td><td>3</td></tr>
              <tr><td>2</td><td>AA001</td><td>Worker two</td><td>Steel fixer</td><td>250</td><td>10</td><td>W</td><td>10</td><td>&hellip;</td><td>1</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Show the day of the week next to each date so weekly off days are obvious, and give every
          worker a unique ID so the same name on two projects can never be confused.
        </p>

        <h2>3. Attendance codes with a legend</h2>
        <p>
          Use numbers for hours worked and a short set of codes for everything else. A common set is{" "}
          <strong>A</strong> for absent, <strong>W</strong> for the weekly off day and{" "}
          <strong>H</strong> for a public holiday. The exact codes matter less than printing a
          legend, so the client reads each cell the way you do.
        </p>

        <h2>4. The summary by trade and project</h2>
        <p>
          Under the roster, group the hours by trade and project, then show the agreed rate and the
          amount for each line. This is the part the invoice is built from, so the totals here
          should match the invoice exactly.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr><th>Trade</th><th>Project</th><th>Hours</th><th>Rate</th><th>Amount (AED)</th></tr>
            </thead>
            <tbody>
              <tr><td>Mason</td><td>Project A</td><td>217</td><td>10</td><td>2,170.00</td></tr>
              <tr><td>Steel fixer</td><td>Project A</td><td>250</td><td>10</td><td>2,500.00</td></tr>
              <tr><td><strong>Total</strong></td><td></td><td><strong>467</strong></td><td></td><td><strong>4,670.00</strong></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Below the totals, list any additions or deductions your contract with the client allows
          (for example absence penalties), then the gross total, any tax and the net amount
          payable. Keep each one on its own line so the client can see exactly how the final figure
          was reached.
        </p>

        <h2>5. Sign-off: prepared, verified, approved</h2>
        <p>
          Three signature blocks protect both sides: who prepared the sheet, who verified it on
          your side and who approved it for the client. Preparing and verifying should be different
          people. An approved, signed timesheet is the document the client&rsquo;s accounts team
          will ask for before paying.
        </p>

        <h2>6. Notes and submission terms</h2>
        <p>
          A short notes block at the foot of the page saves repeated emails. State how soon the
          invoice must be submitted after the timesheet is received, that the timesheet must be
          attached, and how missing hours should be reported.
        </p>

        <h2>Mistakes that cause invoice disputes</h2>
        <ul>
          <li>Hours entered without a worker ID, so two people with similar names are merged.</li>
          <li>Mixing several projects on one sheet without a project column.</li>
          <li>Editing hours after the client has signed.</li>
          <li>Totals that do not match the invoice, even by a few hours.</li>
          <li>A period that crosses the month end without saying so.</li>
        </ul>

        <h2>From a spreadsheet to a repeatable process</h2>
        <p>
          Rebuilding this sheet in Excel every month, for every client, is where errors creep in. If
          attendance is recorded once against each worker, the timesheet, its summary and the
          invoice can all be produced from the same data, in your client&rsquo;s layout, on your
          letterhead. See how{" "}
          <a href="/timesheet-software-construction-uae">timesheet software for UAE construction</a>{" "}
          works, and how the same hours flow into{" "}
          <a href="/wps-payroll-software-uae">WPS payroll</a> without being typed again.
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
