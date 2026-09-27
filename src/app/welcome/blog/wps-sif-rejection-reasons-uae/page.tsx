import type { Metadata } from "next";
import { ContentShell } from "../../content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "wps-sif-rejection-reasons-uae")!;
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
          A Wage Protection System (WPS) salary file, the SIF (Salary Information File), bouncing
          back from your bank is one of the most disruptive things that can happen to payroll for a
          manpower supplier — hundreds of workers waiting to be paid, and no clear error message
          beyond &ldquo;rejected&rdquo;. Most rejections trace back to one of a handful of causes,
          nearly all of them preventable with the right checks before the file is submitted.
        </p>

        <h2>1. The totals don&rsquo;t match, down to the fils</h2>
        <p>
          Every SIF file carries a control record with the total number of employees and the total
          salary amount, which must match the sum of every individual employee record exactly. A
          single AED 0.01 rounding difference anywhere in the file — often from how overtime or a
          deduction was rounded — is enough for the whole file to be rejected, not just that one
          row.
        </p>

        <h2>2. IBAN formatting errors</h2>
        <p>
          A UAE IBAN is a fixed 23 characters, starting with <strong>AE</strong>. Extra spaces, a
          dash, a transposed digit, or an IBAN that was never updated after an employee switched
          banks or exchange houses are all common causes of an instant rejection on that record.
        </p>

        <h2>3. Labour card or employee ID mismatches</h2>
        <p>
          An extra leading zero, a stray space, or a labour card number that wasn&rsquo;t updated
          after a status change (a renewal, a cancellation, a transfer) will fail the match against
          MOHRE&rsquo;s own registry. The file looks fine to the eye; the bank&rsquo;s system sees a
          record that doesn&rsquo;t reconcile.
        </p>

        <h2>4. Structural and formatting errors</h2>
        <p>
          The SIF format is strict about field order, delimiters and date formats. A misplaced
          delimiter or a date in the wrong format can be enough to reject the entire batch, even
          when every salary figure in it is correct.
        </p>

        <h2>5. Mismatches against MOHRE&rsquo;s own records</h2>
        <p>
          Duplicate employee IDs across companies, an expired work permit, or a salary that
          doesn&rsquo;t match what&rsquo;s on file with MOHRE for that contract will also bounce the
          file — this is the category that&rsquo;s hardest to catch by eye, since the error isn&rsquo;t
          in your file at all, but in how it compares against a government record you don&rsquo;t see.
        </p>

        <h2>How to stop this recurring every month</h2>
        <p>
          Nearly all of the above comes down to one thing: bank details, labour card numbers and
          salary structure living correctly on each employee&rsquo;s record before payroll runs, not
          re-typed into a spreadsheet every month. A payroll run that reads bank and salary details
          straight from the employee record, and computes totals the same way the SIF format expects
          before export, removes most of the manual re-entry that causes these mismatches in the
          first place.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
