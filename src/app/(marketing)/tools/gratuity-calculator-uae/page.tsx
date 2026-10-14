import type { Metadata } from "next";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { CtaBand, PageHero, Section } from "@/app/(marketing)/welcome/content-blocks";
import { gratuityBreakdown } from "@/lib/gratuity";
import { JsonLd, faqLd, webApplicationLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import { aed } from "../calc-ui";
import s from "../calculator.module.css";
import { GratuityCalculator } from "./gratuity-calculator";

const tool = TOOLS.find((t) => t.slug === "gratuity-calculator-uae")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["gratuity calculator UAE", "end of service calculator UAE", "EOSB calculator", "UAE labour law gratuity"],
  alternates: { canonical: `${SITE_URL}${PATH}` },
});

const FAQS = [
  {
    q: "Is UAE gratuity calculated on basic salary or total salary?",
    a: "On the last basic salary only. Housing, transport and other allowances, commissions and overtime are not part of the base.",
  },
  {
    q: "How many days of gratuity are paid for each year of service?",
    a: "21 days of basic salary for each of the first five years, and 30 days for each year after that. Part years count in proportion.",
  },
  {
    q: "Is there a maximum gratuity?",
    a: "Yes. The total cannot exceed two years of the employee's basic salary, however long they have served.",
  },
  {
    q: "How long must someone work to be entitled to gratuity?",
    a: "At least one full year of continuous service. Under a year, nothing accrues.",
  },
  {
    q: "When must gratuity be paid?",
    a: "Within 14 days of the employee's last working day, which is why the figure should already be known before they leave.",
  },
] as const;

// Worked examples come from the same code the calculator runs, so the page can never disagree with it.
const EXAMPLES = [3, 5, 8].map((years) => ({ years, b: gratuityBreakdown(3000, years) }));

export default function GratuityCalculatorPage() {
  return (
    <ContentShell>
      <JsonLd
        data={[
          webApplicationLd({ path: PATH, name: tool.title, description: tool.description, category: "FinanceApplication" }),
          faqLd(FAQS),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="UAE gratuity calculator"
        lead="Work out end-of-service gratuity from basic salary and service dates, with every step of the calculation shown."
        cta={false}
      />

      <Section>
        <GratuityCalculator />
      </Section>

      <Section surface>
        <div className={s.prose}>
          <h2>How UAE gratuity is calculated</h2>
          <p>
            Under Article 51 of Federal Decree-Law No. 33 of 2021, an employee who has completed at least
            one year of continuous service is entitled to end-of-service gratuity, calculated on their{" "}
            <strong>last basic salary</strong>:
          </p>
          <ul>
            <li>21 days&rsquo; basic salary for each of the first five years of service.</li>
            <li>30 days&rsquo; basic salary for each year beyond five.</li>
            <li>Part years count in proportion, and the total is capped at two years&rsquo; basic salary.</li>
          </ul>
          <p>A day&rsquo;s basic salary is the monthly basic divided by 30.</p>

          <h2>Worked examples</h2>
          <p>For an employee on a basic salary of {aed(3000)} a month (a day is {aed(100)}):</p>
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Working</th>
                <th>Gratuity</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLES.map(({ years, b }) => (
                <tr key={years}>
                  <td>{years} years</td>
                  <td>
                    {b.firstYears} × 21 days
                    {b.beyondYears > 0 ? ` + ${b.beyondYears} × 30 days` : ""}
                  </td>
                  <td>{aed(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>What this calculator doesn&rsquo;t cover</h2>
          <ul>
            <li>
              <strong>Unpaid leave and breaks in service.</strong> Periods that don&rsquo;t count towards service
              change the length used. Adjust the dates to reflect them.
            </li>
            <li>
              <strong>Contract terms and alternative schemes.</strong> Employers can offer a voluntary alternative
              end-of-service scheme, and some free zones, such as DIFC, run their own. Check which applies.
            </li>
            <li>
              <strong>Other settlement items</strong> such as unused leave, notice pay and deductions.
            </li>
          </ul>
          <p>
            Treat the result as a planning figure and confirm it against the employee&rsquo;s contract and
            the current rules before paying.
          </p>

          <h2>Gratuity belongs in payroll, not in a spreadsheet at exit</h2>
          <p>
            Gratuity builds up every month. For a manpower supplier with hundreds of workers, calculating it
            at the point of leaving is slow and error-prone, and the amount is due within 14 days.{" "}
            <a href="/wps-payroll-software-uae">WPS payroll software</a> that keeps basic salary and joining date on
            the employee record applies the same formula automatically. For the full rules, read{" "}
            <a href="/blog/eosb-gratuity-calculation-uae">how end-of-service gratuity is calculated in the UAE</a>, and
            see how gratuity feeds your price in{" "}
            <a href="/tools/manpower-hourly-rate-calculator">the manpower hourly rate calculator</a>.
          </p>

          <h2>Frequently asked questions</h2>
          {FAQS.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand
        title="Have gratuity calculated for every leaver."
        lead="ManpowerSync keeps basic salary, joining date and gratuity on the same employee record as payroll."
      />
    </ContentShell>
  );
}
