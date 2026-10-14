import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "stop-client-timesheet-disputes-labour-supply-invoices")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

export const metadata: Metadata = finishMetadata({
  title: "How to Stop Client Timesheet Disputes",
  description: post.description,
  alternates: { canonical: URL },
  openGraph: { title: post.title, description: post.description, url: URL, type: "article" },
});

const FAQS = [
  {
    q: "Why do clients dispute labour supply invoices?",
    a: "Almost always because the hours on the invoice differ from the hours the client's own team recorded: different rounding, overtime or rest-day treatment, missing sign-offs, late corrections, or a rate that doesn't match the agreement.",
  },
  {
    q: "Who should sign a timesheet before it is invoiced?",
    a: "Whoever the client has nominated to confirm hours on site, usually a supervisor or site manager, agreed in writing at the start of the contract. An invoice backed by a signed timesheet is far harder to dispute.",
  },
  {
    q: "How soon should timesheet exceptions be resolved?",
    a: "In the same week they occur. A disagreement about a Tuesday shift is easy to settle on Friday and very hard to settle after the month's invoice has been issued.",
  },
] as const;

export default function Page() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(FAQS)} />
      <PostLayout post={post}>
        <p>
          A disputed invoice rarely means the client is acting in bad faith. It means two sets of records
          disagree, and nobody agreed in advance how to settle it. For a labour supplier the cost is real:
          a short-paid invoice still has to fund wages, camp and transport on time, and chasing the
          difference eats the margin on the hours that were never in doubt.
        </p>

        <h2>Where disputes actually come from</h2>
        <ul>
          <li>
            <strong>Different hours, same worker.</strong> The client&rsquo;s gate or site log shows one
            figure and your timesheet another, often by a few minutes a day that add up over a month.
          </li>
          <li>
            <strong>Unclear overtime and rest-day treatment.</strong> What counts as overtime, which
            multiplier applies and how a rest day or public holiday is billed are not written down, so each
            side assumes its own version.
          </li>
          <li>
            <strong>Missing or late sign-off.</strong> Hours are keyed in, nobody on the client side
            confirms them, and the first the client sees of them is the invoice.
          </li>
          <li>
            <strong>Corrections after the fact.</strong> A timesheet is edited after approval and the
            invoice no longer matches what was signed.
          </li>
          <li>
            <strong>Rate mismatches.</strong> A worker redeployed to another project is billed at the old
            project&rsquo;s rate, or one rate is applied across trades that were agreed separately.
          </li>
        </ul>

        <h2>Agree the rules before the first invoice</h2>
        <p>
          Most of the list above is settled by a short schedule in the contract: how time is rounded,
          the standard day, which hours are overtime and at what multiplier, how rest days and holidays are
          treated, who signs timesheets and by when, and how late changes are handled. Writing it down
          turns an argument about who is right into a check against an agreed rule. The layout of the
          timesheet itself matters too; see{" "}
          <a href="/blog/construction-timesheet-format-labour-supply-uae">a client-ready labour supply timesheet format</a>.
        </p>

        <h2>Use one set of hours for payroll and the invoice</h2>
        <p>
          When payroll runs from one spreadsheet and invoices from another, the two drift apart and
          every difference becomes a question. Keep a single approved record of hours per worker per day,
          and let both the salary run and the client invoice read from it. Then any change shows up in
          both places, and you can answer &ldquo;why does this differ&rdquo; from one source.
        </p>

        <h2>Get sign-off before you invoice, not after</h2>
        <ol>
          <li>Collect the timesheet from site on the agreed day each period.</li>
          <li>Have the client&rsquo;s nominated person confirm it, and keep the signed copy.</li>
          <li>Resolve any difference now, while people remember the shift.</li>
          <li>Invoice only from the confirmed figures, with the timesheet attached.</li>
        </ol>

        <h2>Keep a trail of every change</h2>
        <p>
          If an approved timesheet is amended, record who changed what and when. A visible history
          answers most disputes in one message, and an unexplained edit is the quickest way to lose a
          client&rsquo;s trust. It also protects the supplier: a record that shows the client approved
          the hours settles the question for both sides.
        </p>

        <h2>Check the rate before it goes out</h2>
        <p>
          Confirm the rate on each line matches the trade and project it was agreed for. Setting rates per
          client and per project, rather than one company-wide number, removes a whole class of errors. If
          you are not sure your rates cover your costs in the first place, work them through with the free{" "}
          <a href="/tools/manpower-hourly-rate-calculator">manpower hourly rate calculator</a>, and see how
          the same approved hours become a client invoice in{" "}
          <a href="/construction-invoicing-software-uae">VAT invoicing software for manpower suppliers</a> and{" "}
          <a href="/timesheet-software-construction-uae">timesheet software for UAE manpower teams</a>.
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
