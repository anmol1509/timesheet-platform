import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "labour-card-work-permit-visa-difference-uae")!;
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
          Anyone new to running a UAE workforce quickly runs into three documents that sound
          similar, get confused with each other constantly, and each carry their own expiry date
          and their own consequence if they lapse. Here&rsquo;s the plain-language difference.
        </p>

        <h2>Entry permit / work permit</h2>
        <p>
          This is the document that lets someone <strong>enter and work in the UAE in the first
          place</strong>, issued before the residence visa itself. It&rsquo;s the earliest of the three in
          a new hire&rsquo;s timeline — sponsored by the employer, and tied to the specific job they&rsquo;re
          being brought in for.
        </p>

        <h2>Residence visa</h2>
        <p>
          Once someone is in the country and has completed the medical and Emirates ID process, they
          receive a residence visa — the document that lets them <strong>live</strong> in the UAE,
          separate from the right to work itself. This is the one most people mean when they say
          &ldquo;visa,&rdquo; and it has to be renewed periodically (commonly every one to three
          years depending on the visa type) or the worker&rsquo;s legal residency lapses along with it.
        </p>

        <h2>Labour card</h2>
        <p>
          The labour card is issued by the Ministry of Human Resources and Emiratisation (MOHRE) and
          is what formally registers the employment relationship itself — proof that this specific
          worker is employed by this specific company, separate from their right to reside in the
          country. A worker can have a valid residence visa and still have an issue if their labour
          card isn&rsquo;t current, or if it hasn&rsquo;t been updated after a transfer or contract change.
        </p>

        <h2>Why the distinction matters operationally</h2>
        <p>
          These three documents lapse independently of each other, on different schedules, and a
          problem with one doesn&rsquo;t necessarily show up as a problem with another until someone
          checks — which is exactly why WPS salary files get rejected over a labour card that wasn&rsquo;t
          updated even though the worker&rsquo;s visa is perfectly valid, and why compliance tracking
          has to follow all three separately rather than treating &ldquo;is this worker&rsquo;s paperwork in
          order&rdquo; as a single yes/no question.
        </p>

        <p>
          Tracking entry permit, residence visa and labour card as three distinct fields — each with
          its own expiry date and its own alert — is the only way to actually know which one is the
          problem when something doesn&rsquo;t match, instead of finding out only when a file bounces or
          a fine arrives.
        </p>
      </PostLayout>
    </ContentShell>
  );
}
