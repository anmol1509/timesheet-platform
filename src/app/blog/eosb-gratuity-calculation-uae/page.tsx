import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "eosb-gratuity-calculation-uae")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
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
          End-of-service gratuity (EOSB) is one of the few payroll calculations in the UAE with an
          exact legal formula behind it — Article 51 of Federal Decree-Law No. 33 of 2021 — which
          means it&rsquo;s also one where a wrong number is easy to notice and hard to explain away.
          For a manpower supplier settling dozens of leavers a month, getting the formula right
          consistently matters more than getting it right once.
        </p>

        <h2>Who&rsquo;s entitled to it</h2>
        <p>
          Any private-sector employee who has completed at least one full year of continuous
          service with the same employer is entitled to gratuity, whether their contract is limited
          or unlimited, full-time or part-time (calculated proportionally for part-time).
        </p>

        <h2>The formula</h2>
        <p>Gratuity is calculated on the employee&rsquo;s <strong>last basic salary</strong>, not gross:</p>
        <ul>
          <li>21 days&rsquo; basic salary for each of the first five years of service.</li>
          <li>30 days&rsquo; basic salary for each year beyond five.</li>
          <li>Capped at two years&rsquo; total basic salary, however long the service.</li>
        </ul>
        <p>
          Allowances, commissions and overtime are excluded from the base figure entirely — only the
          basic salary component counts, which is exactly the field that has to be tracked
          separately and accurately for every employee, not bundled into one all-in monthly figure.
        </p>

        <h2>When it&rsquo;s due</h2>
        <p>
          The full amount is payable within 14 days of the employee&rsquo;s last working day — a short
          window that leaves little room for a calculation to be worked out from scratch after
          someone has already left.
        </p>

        <h2>The alternative scheme</h2>
        <p>
          Since Cabinet Resolution No. 96 of 2023, employers can opt into a Voluntary Alternative
          End-of-Service Benefits Scheme instead — monthly contributions into a regulated investment
          fund rather than a lump sum calculated at exit. Either way, the same underlying question
          has to be answered correctly: what was this person&rsquo;s basic salary, and how long did they
          actually serve.
        </p>

        <h2>Why this is a system problem, not a one-off calculation</h2>
        <p>
          The formula itself isn&rsquo;t complicated. What&rsquo;s hard is applying it correctly, every
          time, across a workforce where basic salary, join date and service breaks are scattered
          across old contracts and spreadsheets. Payroll that already separates basic salary from
          allowances for every employee, and tracks join date and any service gaps on the same
          record, turns EOSB from a manual recalculation into a number the system already has.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
