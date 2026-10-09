import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "how-to-price-manpower-supply-uae-hourly-rate")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

const SEO_TITLE = "How to Price Manpower Supply in the UAE: Hourly Rate Guide";

const FAQS = [
  {
    "q": "How do you calculate the hourly rate for a manpower supply worker?",
    "a": "Add up the monthly cost of the worker (salary and allowances, visa and permit costs spread over their validity, accommodation, transport, food and gas, gratuity and leave provisions), add overhead, add your margin, then divide by the hours you can actually bill in a month. Dividing by hours actually billed, not hours paid, is what keeps the rate honest."
  },
  {
    "q": "How many billable hours should I assume per worker per month?",
    "a": "Use the hours your client really pays for. A common starting point is 26 working days of 8 hours, which is 208 hours. If absences, public holidays and site delays mean some of those hours are never billed, divide by the lower figure, because you still carry the cost of the hours you cannot bill."
  },
  {
    "q": "Should the same hourly rate apply to every trade?",
    "a": "No. Each trade has a different salary, a different cost to recruit and a different market rate, so build the rate trade by trade and review it whenever salary or visa costs change."
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
          Most manpower suppliers in the UAE price the same way: take the worker&rsquo;s salary,
          add a margin, round up. It feels safe, and it is the most common reason a contract that
          looks profitable on paper loses money in practice. A worker&rsquo;s real cost is much more
          than their salary, and the hours you can bill are fewer than the hours you pay for.
        </p>
        <p>
          This guide builds an hourly rate from the ground up, with a worked example you can
          replace with your own figures.
        </p>

        <h2>The cost components to include</h2>
        <ol>
          <li>
            <strong>Salary and allowances.</strong> Basic pay plus housing, food, transport and any
            other fixed allowance in the worker&rsquo;s contract.
          </li>
          <li>
            <strong>Visa and permit costs.</strong> The entry visa, Emirates ID, labour card or work
            permit and medical insurance. These are paid up front but last for the validity of the
            document, so spread each one over that period instead of charging it all to month one.
            The{" "}
            <a href="/blog/labour-card-work-permit-visa-difference-uae">
              difference between a labour card, a work permit and a visa
            </a>{" "}
            tells you which of them you are paying for and when each one renews.
          </li>
          <li>
            <strong>Accommodation.</strong> Rent, utilities and upkeep of the camp, divided by the
            beds you actually fill, not the beds you have.
          </li>
          <li>
            <strong>Transport.</strong> Buses, drivers, fuel and maintenance, divided across the
            workers who use them.
          </li>
          <li>
            <strong>Food, gas and consumables</strong> that you provide to workers.
          </li>
          <li>
            <strong>Provisions.</strong> End-of-service gratuity builds up every month a worker
            stays; see{" "}
            <a href="/blog/eosb-gratuity-calculation-uae">how gratuity is calculated</a>. Annual
            leave and the return air ticket are similar costs that arrive later but belong to the
            months being worked now.
          </li>
          <li>
            <strong>Overhead.</strong> Office staff, supervisors, software, insurance and licence
            fees, spread across the workforce.
          </li>
          <li>
            <strong>Margin.</strong> What is left after everything above, and the thing the whole
            exercise is meant to protect.
          </li>
        </ol>

        <h2>Work out the hours you can actually bill</h2>
        <p>
          A common starting point is 26 working days of 8 hours, or 208 hours a month. But some of
          those hours will not be billed: absences, public holidays the client does not pay for,
          waiting time and site delays. You still pay the worker for those days, so the cost has to
          be recovered from the hours that are billed.
        </p>

        <h2>A worked example</h2>
        <p>
          The figures below are illustrative only. Replace them with your own costs.
        </p>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Monthly cost per worker</th>
                <th>AED</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Salary and allowances</td><td>1,500.00</td></tr>
              <tr><td>Visa, Emirates ID, labour card and medical insurance, spread over 24 months</td><td>120.00</td></tr>
              <tr><td>Accommodation</td><td>200.00</td></tr>
              <tr><td>Transport</td><td>150.00</td></tr>
              <tr><td>Food, gas and consumables</td><td>100.00</td></tr>
              <tr><td>End-of-service gratuity provision</td><td>100.00</td></tr>
              <tr><td>Annual leave and air ticket provision</td><td>100.00</td></tr>
              <tr><td><strong>Direct cost</strong></td><td><strong>2,270.00</strong></td></tr>
              <tr><td>Overhead at 10% of direct cost</td><td>227.00</td></tr>
              <tr><td><strong>Total cost</strong></td><td><strong>2,497.00</strong></td></tr>
              <tr><td>Margin at 15% of total cost</td><td>374.55</td></tr>
              <tr><td><strong>Monthly price per worker</strong></td><td><strong>2,871.55</strong></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          Divided by 208 billable hours, that is <strong>AED 13.81 an hour</strong>. But if 8% of
          those hours are never billed because of absences and unpaid holidays, only 191 hours are
          billed, and the same monthly price needs an hourly rate of{" "}
          <strong>AED 15.01</strong> to deliver the same result. That gap of AED 1.20 an hour, on
          every hour of every worker, is the margin that quietly disappears when a rate is set on
          paid hours instead of billed hours.
        </p>

        <h2>Common pricing mistakes</h2>
        <ul>
          <li>Dividing salary by 30 days and treating that as the cost of a billable day.</li>
          <li>Charging visa and permit costs to the first month instead of spreading them over their validity.</li>
          <li>Using one rate for every trade, so the cheap trades subsidise the expensive ones.</li>
          <li>Setting a rate once and never revisiting it when salary, rent or fuel costs change.</li>
          <li>Ignoring payment terms: a client that pays in 60 or 90 days costs you the financing of every worker in the meantime.</li>
        </ul>

        <h2>Keep your rate honest with real numbers</h2>
        <p>
          A rate is only as good as the costs behind it. When salaries, camp costs and billed hours
          live in the same system, you can compare what a trade really costs with what you charge
          for it, month by month, instead of finding out at year end. See how{" "}
          <a href="/construction-invoicing-software-uae">construction invoicing</a> and{" "}
          <a href="/wps-payroll-software-uae">WPS payroll</a> draw on the same records in
          ManpowerSync, or read about the plans on the <a href="/pricing">pricing page</a>.
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
