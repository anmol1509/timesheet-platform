import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "labour-camp-occupancy-beds-checkins-cost-per-bed")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

export const metadata: Metadata = finishMetadata({
  title: "Labour Camp Occupancy and Cost per Bed",
  description: post.description,
  alternates: { canonical: URL },
  openGraph: { title: post.title, description: post.description, url: URL, type: "article" },
});

const FAQS = [
  {
    q: "How do you calculate labour camp occupancy?",
    a: "Divide the number of beds occupied on a given day by the total number of beds available, and express it as a percentage. Track it daily or weekly rather than once a month, because it moves as crews mobilise and demobilise.",
  },
  {
    q: "What is cost per occupied bed?",
    a: "The camp's monthly cost (rent, utilities, upkeep, caretaking) divided by the beds actually occupied, not the beds available. Empty beds still cost money, so this is the figure to compare with what you recover from clients.",
  },
  {
    q: "What records should a camp keep?",
    a: "For each bed: the room, the capacity, who is assigned, the check-in date and the check-out date. For each person: which camp and bed they are in today. Without these, occupancy is a guess.",
  },
] as const;

export default function Page() {
  return (
    <ContentShell>
      <JsonLd data={faqLd(FAQS)} />
      <PostLayout post={post}>
        <p>
          Accommodation is one of the largest costs a manpower supplier carries per worker, and one of the
          least measured. Rent and utilities arrive every month whether the beds are full or not, so a
          camp that runs at 80% occupancy quietly costs a quarter more per person than the same camp
          at 100%. Most suppliers only notice when the numbers are far off.
        </p>

        <h2>Two numbers worth tracking</h2>
        <p>
          <strong>Occupancy</strong> is occupied beds divided by available beds. <strong>Cost per occupied
          bed</strong> is the camp&rsquo;s monthly cost divided by the beds actually filled. The second is
          the one that belongs in your pricing, because it is what each housed worker really costs you.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Example camp</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Monthly cost (rent, utilities, upkeep)</td><td>AED 20,000</td></tr>
              <tr><td>Beds available</td><td>100</td></tr>
              <tr><td>Beds occupied</td><td>80</td></tr>
              <tr><td>Occupancy</td><td>80%</td></tr>
              <tr><td>Cost per available bed</td><td>AED 200</td></tr>
              <tr><td><strong>Cost per occupied bed</strong></td><td><strong>AED 250</strong></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          The figures are illustrative. The point is the gap: pricing accommodation at AED 200 a bed when
          each filled bed costs AED 250 gives away AED 50 a worker every month. The same logic is part of
          building a rate that covers your costs, which is worked through in{" "}
          <a href="/blog/how-to-price-manpower-supply-uae-hourly-rate">how to price manpower supply in the UAE</a>.
        </p>

        <h2>What to record</h2>
        <ul>
          <li>The camp, its rooms and each room&rsquo;s bed capacity.</li>
          <li>Who is assigned to which bed, with the check-in date.</li>
          <li>The check-out date and the reason when someone leaves.</li>
          <li>Which client or project each occupant is working on, so accommodation can be traced to the contract that uses it.</li>
        </ul>

        <h2>The gaps that inflate cost</h2>
        <ul>
          <li>
            <strong>Beds that look full but aren&rsquo;t.</strong> Someone demobilised weeks ago and no one
            updated the list, so the bed is empty while the record says otherwise.
          </li>
          <li>
            <strong>Empty beds nobody knows about.</strong> A new crew is placed in rented accommodation
            elsewhere while beds stand free in your own camp.
          </li>
          <li>
            <strong>Late check-outs.</strong> The record changes days after the person leaves, so the
            month&rsquo;s occupancy and any recharge to a client are overstated.
          </li>
          <li>
            <strong>No link to deployment.</strong> When crews move between sites, bed assignments and
            transport routes stay as they were, and the camp stops matching the workforce.
          </li>
        </ul>

        <h2>Make occupancy a live record, not a monthly report</h2>
        <p>
          A spreadsheet updated at month end tells you what happened, not what to do today. Check-ins and
          check-outs recorded as they happen, room by room, show free beds when a new demand arrives and
          give an honest cost per bed at any time. See how{" "}
          <a href="/camp-accommodation-management-software-uae">camp and accommodation management software</a> does
          this, and how it connects to the rest of the workforce in a{" "}
          <a href="/manpower-erp-uae">manpower ERP</a>. Buying software for it? Start with{" "}
          <a href="/blog/manpower-supply-software-uae-buyers-checklist">12 questions to ask before you buy</a>.
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
