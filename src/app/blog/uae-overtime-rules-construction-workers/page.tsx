import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "uae-overtime-rules-construction-workers")!;
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
          Overtime is one of the few numbers on a construction payroll run that changes every
          single month, for every single worker, depending on exactly how many hours they worked
          and when. Getting the rate right is straightforward in principle; applying it
          consistently across a few hundred workers by hand, every month, is where mistakes creep
          in.
        </p>

        <h2>The baseline: 8 hours a day, 48 a week</h2>
        <p>
          Normal working time under UAE labour law is 8 hours a day and 48 hours a week. Routine
          overtime on top of that is capped at 2 additional hours a day.
        </p>

        <h2>Overtime rates</h2>
        <ul>
          <li>
            <strong>Standard overtime</strong> (beyond 8 hours/day or 48 hours/week): 125% of the
            hourly basic wage — basic pay plus 25%.
          </li>
          <li>
            <strong>Night overtime</strong> (10pm&ndash;4am): 150% of the hourly basic wage — basic pay
            plus 50%.
          </li>
        </ul>
        <p>
          In both cases, the calculation is based on <strong>basic salary only</strong> — allowances
          are excluded, the same rule that applies to end-of-service gratuity.
        </p>

        <h2>Rest days</h2>
        <p>
          Every employee is entitled to at least one paid rest day a week. Work on that rest day is
          paid at full pay plus a 50% premium, or compensated with an alternative rest day instead.
          Which day counts as the rest day is flexible — it doesn&rsquo;t have to be Friday, and
          employers can designate whichever day fits their business.
        </p>

        <h2>Daily break requirements</h2>
        <p>
          Workers can&rsquo;t be scheduled more than 5 consecutive hours without a break, and total
          breaks across the day must add up to at least an hour — relevant when planning shift
          patterns across a large site workforce, not just an individual worker&rsquo;s hours.
        </p>

        <h2>Why this is hard to apply by hand at scale</h2>
        <p>
          None of these rules are complicated individually. What&rsquo;s hard is applying the right
          rate to the right hour — standard, night, rest-day — consistently across hundreds of
          workers with different shift patterns, every single month, without a system that flags
          the exception automatically as hours come in rather than at month-end reconciliation.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
