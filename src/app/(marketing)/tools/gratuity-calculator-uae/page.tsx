import { Calculator } from "lucide-react";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ToolPage } from "../tool-page";
import type { Metadata } from "next";
import { gratuityBreakdown } from "@/lib/gratuity";
import { faqLd, webApplicationLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import { aed } from "../calc-ui";
import { GratuityCalculator } from "./gratuity-calculator";

const tool = TOOLS.find((t) => t.slug === "gratuity-calculator-uae")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["gratuity calculator UAE", "end of service calculator UAE", "end of service calculator Dubai", "Dubai gratuity calculation", "UAE gratuity calculator Abu Dhabi", "EOSB calculator", "UAE labour law gratuity"],
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
    q: "Is the gratuity calculation different in Dubai and Abu Dhabi?",
    a: "No. For employees on the mainland, the same federal law applies in every emirate, so a Dubai gratuity calculation and an Abu Dhabi one use the same formula. Free zones such as DIFC and ADGM can have their own end-of-service rules, so check yours.",
  },
  {
    q: "Who decides the end of service figure, and what is MOHRE's role?",
    a: "The law sets the formula and the employer pays it. MOHRE, the ministry that administers the labour law, is where a disagreement about the figure normally starts, so keep the contract, the wage record and the service dates to hand.",
  },
  {
    q: "What is a final settlement?",
    a: "Everything an employee is owed when they leave: unpaid wages, gratuity, pay for unused annual leave and any other contractual dues, less valid deductions. Gratuity is one part of it.",
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
    <ToolPage
      slug="gratuity-calculator-uae"
      accent={ACCENTS.violet}
      hero={{
        pill: "Free calculator",
        pillIcon: <Calculator size={14} aria-hidden />,
        title: <>UAE <em>gratuity calculator</em></>,
        lead: "Work out end-of-service gratuity for Dubai, Abu Dhabi and the rest of the UAE from basic salary and service dates, with every step shown.",
        badges: ["Free, no sign-up", "Working shown step by step", "Nothing leaves your browser"],
      }}
      ld={[webApplicationLd({ path: PATH, name: tool.title, description: tool.description, category: "FinanceApplication" }), faqLd(FAQS)]}
      tool={<GratuityCalculator />}
      how={[
        { title: "Enter basic salary", body: "Last basic only: allowances and overtime aren't part of the base." },
{ title: "Add the service dates", body: "Joining and last working day; part years count in proportion." },
{ title: "Read the working", body: "The amount, with 21-day and 30-day years shown separately." },
      ]}
      article={
        <>
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

          <h2>Gratuity rules in the UAE at a glance</h2>
          <ul>
            <li><strong>Eligibility:</strong> at least one year of continuous service. Under a year, nothing accrues.</li>
            <li><strong>Base:</strong> the last basic salary only, not allowances, commissions or overtime.</li>
            <li><strong>Rate:</strong> 21 days of basic salary for each of the first five years, 30 days for each year after.</li>
            <li><strong>Cap:</strong> two years of basic salary in total.</li>
            <li><strong>Timing:</strong> payable within 14 days of the last working day.</li>
          </ul>
          <p>
            The wider picture is in <a href="/blog/uae-gratuity-rules-eligibility">UAE gratuity rules and eligibility</a>, and
            gratuity is one line of a <a href="/blog/final-settlement-uae-labour-law">final settlement</a>.
          </p>

          <h2>Gratuity calculation in Dubai and Abu Dhabi</h2>
          <p>
            For mainland employees the same federal law applies in every emirate. A Dubai gratuity calculation and an
            Abu Dhabi one therefore give the same answer for the same salary and service, and this works as an end of
            service calculator for Dubai, Abu Dhabi, Sharjah and the rest of the UAE. Free zones are the exception:
            DIFC and ADGM, for example, have their own employment rules, and some employers offer an approved
            alternative scheme, so confirm which regime your employee falls under.
          </p>

          <h2>MOHRE and the end of service figure</h2>
          <p>
            MOHRE, the Ministry of Human Resources and Emiratisation, administers UAE labour law (also written labor
            law). This calculator applies the formula in Decree-Law 33 of 2021, the same law MOHRE works from, but it is
            not a MOHRE tool. If an employee and employer disagree on the amount, the dispute normally starts with MOHRE,
            which looks at the contract, the wage record and the service dates, so keep all three.
          </p>

          <h2>How to calculate your own gratuity</h2>
          <ol>
            <li>Find your last monthly basic salary on your contract or payslip, ignoring allowances.</li>
            <li>Enter your joining date and your last working day.</li>
            <li>Read the result: the first five years at 21 days each, any further years at 30 days, and any cap.</li>
            <li>Remember gratuity is only part of your final pay. See <a href="/blog/final-settlement-uae-labour-law">what a final settlement includes</a>.</li>
          </ol>

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
        </>
      }
      next={{ title: "Have gratuity calculated for every leaver.", body: "WPS payroll software keeps basic salary and joining date on the employee record, so the same formula applies automatically and the figure is known before anyone leaves.", href: "/wps-payroll-software-uae", label: "See WPS payroll software" }}
      faqs={FAQS}
    />
  );
}
