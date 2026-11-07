import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "manpower-contract-profitability-billable-hours")!;
const url = `https://manpowersync.com/blog/${post.slug}`;
export const metadata: Metadata = finishMetadata({ title: post.title, description: post.description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { title: post.title, description: post.description, url, type: "article" } });

export default function Page() {
  return <ContentShell><PostLayout post={post}>
    <p>A headline hourly rate tells you only what the client pays for an approved hour. To understand whether a manpower contract makes money, compare the actual hours billed with the full costs of providing the workers over the same period.</p>
    <h2>Paid hours and billable hours are not the same</h2>
    <p>Workers may be paid for hours that the client will not accept for billing. Site delays, absences, standby, overtime and holidays need to be checked against the employment arrangement and client contract. A quoted rate based on 208 billable hours will recover less than planned if only 160 hours are approved.</p>
    <h2>A worked example</h2>
    <p>Suppose a worker costs AED 2,400 for a month after salary, allowances, accommodation, transport, provisions and an allocated share of overhead. The client rate is AED 15 per hour. These are illustrative figures, before tax and financing costs.</p>
    <ul><li>At 200 billable hours, revenue is AED 3,000 and the amount left after the listed costs is AED 600.</li><li>At 160 billable hours, revenue is AED 2,400 and the amount left is AED 0.</li><li>At 140 billable hours, revenue is AED 2,100, a shortfall of AED 300 against those costs.</li></ul>
    <p>Other costs may still apply. The example is not a full profit-and-loss statement; include financing, unallocated overhead, losses and tax as appropriate. Record the reason hours fell before deciding how to respond.</p>
    <h2>Include the costs that arrive later</h2>
    <p>Depending on your arrangements, costs may include recruitment, permits, insurance, camp beds, transport, supervision, leave and end-of-service provisions. Spread an up-front cost over the period it covers when budgeting, and avoid counting the same cost twice. Use your accountant&rsquo;s treatment for your books.</p>
    <h2>Markup is different from margin</h2>
    <p>A 15% markup adds 15% of cost to the selling price. A 15% margin means the difference between price and cost is 15% of the price. For AED 2,400 of cost, a 15% markup gives AED 2,760; a 15% selling-price margin requires about AED 2,823.53. State which measure your quotation uses.</p>
    <h2>Review each project monthly</h2>
    <ol><li>Reconcile attendance and client-approved hours.</li><li>Compare billed hours and rates with the quotation.</li><li>Compare actual worker and project costs with the budget.</li><li>Investigate differences, payment delays and missing approvals before renewing the rate.</li></ol>
    <p>Use the <a href="/tools/manpower-hourly-rate-calculator">manpower hourly rate calculator</a> for your own assumptions and read the <a href="/blog/how-to-price-manpower-supply-uae-hourly-rate">guide to building a manpower supply rate</a>. The calculator describes its percentage as an addition to cost; check the definition before using the result.</p>
  </PostLayout></ContentShell>;
}
