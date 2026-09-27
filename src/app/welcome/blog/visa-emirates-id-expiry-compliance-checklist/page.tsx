import type { Metadata } from "next";
import { ContentShell } from "../../content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "visa-emirates-id-expiry-compliance-checklist")!;
const URL = `https://manpowersync.com/welcome/blog/${post.slug}`;

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: { canonical: URL },
  openGraph: { title: post.title, description: post.description, url: URL, type: "article" },
};

export default function Page() {
  return (
    <ContentShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            author: { "@type": "Organization", name: "ManpowerSync" },
          }),
        }}
      />
      <PostLayout post={post}>
        <p>
          For a manpower supplier running a workforce of hundreds, visa, Emirates ID, labour card and
          passport expiries aren&rsquo;t an annual HR task — they&rsquo;re a rolling, every-week
          operational job. Most of the fines that land are never a surprise in principle; they&rsquo;re
          a document that expired quietly between one renewal cycle and the next, on a worker nobody
          happened to check that month.
        </p>

        <h2>Why this slips through spreadsheets</h2>
        <p>
          A spreadsheet of expiry dates works until the workforce crosses a few dozen people spread
          across several sites and suppliers. At that point, the same three failure modes show up
          everywhere:
        </p>
        <ul>
          <li>Nobody owns the check on a recurring schedule, so it happens when someone remembers.</li>
          <li>
            Renewals in progress and expired documents look the same in a static list — there&rsquo;s
            no way to tell &ldquo;already being renewed&rdquo; from &ldquo;nobody has noticed yet&rdquo;.
          </li>
          <li>
            The person who needs to act (a supervisor on site, HR, the worker themselves) isn&rsquo;t
            the person looking at the spreadsheet.
          </li>
        </ul>

        <h2>A practical checklist</h2>
        <h3>1. One system of record, not one per site</h3>
        <p>
          Every document — passport, visa, Emirates ID, labour card, medical certificate, driving
          licence — should live against the employee&rsquo;s own record, not in a folder named after
          the month it was collected. If a worker moves site or supplier, their document history
          should move with them.
        </p>

        <h3>2. Alerts before expiry, not on expiry</h3>
        <p>
          A 60/30/15-day warning window gives enough runway to actually process a renewal through
          typing centres and government channels, which routinely takes longer than people expect
          during busy periods. An alert on the day something lapses is a record of the fine, not a
          way to avoid it.
        </p>

        <h3>3. Route the alert to the person who can act</h3>
        <p>
          A dashboard nobody opens isn&rsquo;t a compliance system. Expiry alerts that reach the
          right person directly — over WhatsApp, over email, wherever they&rsquo;ll actually see it
          — close the gap between &ldquo;the system flagged it&rdquo; and &ldquo;someone did
          something about it&rdquo;.
        </p>

        <h3>4. Cut re-typing out of the renewal itself</h3>
        <p>
          Renewing a document usually means re-entering the same passport number, name and dates
          that were already typed in once, from a fresh scan. Reading the new document
          automatically and pre-filling the record removes a second source of the same data-entry
          errors that caused problems the first time around.
        </p>

        <h3>5. Keep a paper trail of who saw what, and when</h3>
        <p>
          When MOHRE or a client asks whether a worker&rsquo;s documents were in order on a given
          date, &ldquo;we think so&rdquo; isn&rsquo;t an answer. An audit log of every document
          upload, expiry check and renewal is the difference between a quick answer and a scramble
          through old emails.
        </p>

        <p>
          None of this is complicated in principle — it&rsquo;s a matter of the check actually
          happening every time, for every worker, without depending on someone remembering. That&rsquo;s
          the part software is good at, and spreadsheets aren&rsquo;t.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
