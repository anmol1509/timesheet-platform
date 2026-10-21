import { Percent } from "lucide-react";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ToolPage } from "../tool-page";
import type { Metadata } from "next";
import { faqLd, webApplicationLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import { RateCalculator } from "./rate-calculator";

const tool = TOOLS.find((t) => t.slug === "manpower-hourly-rate-calculator")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["manpower rate calculator UAE", "labour supply hourly rate UAE", "how to price manpower supply", "manpower supply pricing"],
  alternates: { canonical: `${SITE_URL}${PATH}` },
});

const FAQS = [
  {
    q: "Why divide by billable hours instead of paid hours?",
    a: "You pay a worker for every paid hour, but you can only invoice the hours the client accepts. Absences, unpaid holidays and waiting time still cost you, so the month's price has to be recovered from the hours that are billed.",
  },
  {
    q: "What overhead percentage should I use?",
    a: "Add up the monthly cost of office staff, supervisors, software, insurance and licence fees, and divide it by the total direct cost of your workforce. The 10% filled in is only an example.",
  },
  {
    q: "Is margin calculated on cost or on price?",
    a: "On total cost here: a 15% margin adds 15% of total cost to the price. A margin expressed as a share of the selling price would give a different, higher rate for the same percentage.",
  },
  {
    q: "Should every trade have the same rate?",
    a: "No. Run the calculator once per trade with that trade's own salary and costs, otherwise cheaper trades end up subsidising the expensive ones.",
  },
] as const;

export default function HourlyRateCalculatorPage() {
  return (
    <ToolPage
      slug="manpower-hourly-rate-calculator"
      accent={ACCENTS.amber}
      hero={{
        pill: "Free calculator",
        pillIcon: <Percent size={14} aria-hidden />,
        title: <>Manpower supply <em>hourly rate calculator</em></>,
        lead: "Turn a worker's real monthly cost into the hourly rate you need to charge, with overhead, margin and unbilled hours included.",
        badges: ["Free, no sign-up", "Overhead and margin included", "Nothing leaves your browser"],
      }}
      ld={[webApplicationLd({ path: PATH, name: tool.title, description: tool.description, category: "BusinessApplication" }), faqLd(FAQS)]}
      tool={<RateCalculator />}
      how={[
        { title: "Enter the costs", body: "Salary, visa, camp, transport, gratuity and the rest." },
{ title: "Add overhead and margin", body: "As percentages of direct and total cost." },
{ title: "Get the hourly rate", body: "Spread over billable hours, not paid hours." },
      ]}
      article={
        <>
          <h2>How the rate is built</h2>
          <ol>
            <li><strong>Direct cost:</strong> salary and allowances, visa and permit costs spread over their validity, accommodation, transport, food and consumables, and provisions for gratuity, annual leave and the air ticket.</li>
            <li><strong>Overhead:</strong> a percentage of direct cost for office staff, supervisors, software, insurance and licences.</li>
            <li><strong>Margin:</strong> a percentage of total cost (direct cost plus overhead).</li>
            <li><strong>Billable hours:</strong> the hours you are paid for, less the share that is never billed.</li>
          </ol>
          <p>
            The monthly price is the total cost plus margin. Dividing it by billable hours, not paid hours, gives
            the hourly rate that actually delivers the margin you planned.
          </p>

          <h2>The pre-filled example</h2>
          <p>
            The figures filled in are the worked example from our guide to{" "}
            <a href="/blog/how-to-price-manpower-supply-uae-hourly-rate">pricing manpower supply in the UAE</a>: a
            monthly price of AED 2,871.55 per worker. Spread over all 208 paid hours that is AED 13.81 an hour, but
            with 8% of hours unbilled the rate needed is AED 15.01. Change the unbilled percentage to see how quickly a
            small gap erodes margin.
          </p>

          <h2>Common mistakes</h2>
          <ul>
            <li>Pricing from salary alone and treating everything else as free.</li>
            <li>Charging visa and permit costs to the first month instead of spreading them.</li>
            <li>Using one rate for every trade.</li>
            <li>Never revisiting the rate when rent, fuel or salary change.</li>
            <li>Ignoring payment terms: 60 or 90 day clients cost you the financing of every worker meanwhile.</li>
          </ul>
          <p>
            Calculate your gratuity provision with the{" "}
            <a href="/tools/gratuity-calculator-uae">UAE gratuity calculator</a>, and see how{" "}
            <a href="/construction-invoicing-software-uae">VAT invoicing software</a> bills approved hours at each
            client&rsquo;s own rate.
          </p>
        </>
      }
      next={{ title: "Compare the rate you quote with what each trade really costs.", body: "VAT invoicing software bills approved hours at each client's own rate, and shows margin per invoice, so you can check your pricing against real numbers.", href: "/construction-invoicing-software-uae", label: "See VAT invoicing software" }}
      faqs={FAQS}
    />
  );
}
