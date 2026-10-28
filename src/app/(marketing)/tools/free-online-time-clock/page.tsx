import { Clock } from "lucide-react";
import { ACCENTS } from "@/app/(marketing)/welcome/showcase/showcase";
import { ToolPage } from "../tool-page";
import type { Metadata } from "next";
import { faqLd, webApplicationLd } from "@/lib/seo/jsonld";
import { finishMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import { TOOLS } from "../tools-data";
import { TimeClock } from "./time-clock";

const tool = TOOLS.find((t) => t.slug === "free-online-time-clock")!;
const PATH = `/tools/${tool.slug}`;

export const metadata: Metadata = finishMetadata({
  title: tool.title,
  description: tool.description,
  keywords: ["free time clock online", "online time clock free", "free online punch clock", "free employee time clock", "clock in clock out online", "free timesheet clock"],
  alternates: { canonical: `${SITE_URL}${PATH}` },
});

const FAQS = [
  {
    q: "Is this online time clock really free?",
    a: "Yes. There is no sign-up, no trial and no limit on entries. It runs in your browser and costs nothing.",
  },
  {
    q: "Where are my clock-in times stored?",
    a: "On the device you are using, in your browser's local storage. Nothing is uploaded to a server, so nobody else can see them, and clearing your browser data removes them. Download the CSV if you want to keep a copy.",
  },
  {
    q: "Can I use it for a team?",
    a: "It is built for one person on one device. It does not verify who is clocking in or where they are, and entries live in that one browser. For a team, you need a system that records attendance against each worker and keeps one shared record.",
  },
  {
    q: "Can I export my hours to Excel?",
    a: "Yes. Use Download as CSV below the table. The file opens in Excel or Google Sheets with the date, clock in, clock out, hours and note for each entry.",
  },
  {
    q: "What happens if I close the page while clocked in?",
    a: "The clock keeps your start time. When you reopen the page on the same device and browser, it still shows you as clocked in and counts the elapsed time. Private browsing windows do not keep it.",
  },
  {
    q: "Is a free time clock enough for UAE labour law?",
    a: "It records hours, but a legal timesheet for payroll or a client invoice usually also needs a worker ID, the project, approval and a record that cannot be quietly edited. Treat this as a personal log, and use a proper timesheet process for payroll and billing.",
  },
] as const;

export default function FreeOnlineTimeClockPage() {
  return (
    <ToolPage
      slug="free-online-time-clock"
      accent={ACCENTS.blue}
      hero={{
        pill: "Free tool",
        pillIcon: <Clock size={14} aria-hidden />,
        title: <>Free online <em>time clock</em></>,
        lead: "Clock in and out from any browser, see your hours add up by day, and download them as a spreadsheet. No account needed.",
        badges: ["Free, no sign-up", "Saved on your device only", "Download as CSV"],
      }}
      ld={[webApplicationLd({ path: PATH, name: tool.title, description: tool.description, category: "BusinessApplication" }), faqLd(FAQS)]}
      tool={<TimeClock />}
      how={[
        { title: "Clock in", body: "Press the button when you start, with an optional note for the site or task." },
        { title: "Clock out", body: "Press it again when you finish. The session is saved with its hours." },
        { title: "Download your hours", body: "Get the day-by-day list as a CSV for Excel or Google Sheets." },
      ]}
      article={
        <>
          <h2>What this free online time clock does</h2>
          <p>
            It is a simple punch clock for one person. Clock in when you start, clock out when you stop, and each session is
            saved with its date, start and end time, and the hours between them. The running total and today&rsquo;s hours
            update as you go, and you can download everything as a CSV file for a spreadsheet.
          </p>

          <h2>Who it suits, and who it doesn&rsquo;t</h2>
          <ul>
            <li><strong>Suits:</strong> freelancers, contractors and anyone who wants a personal record of hours worked.</li>
            <li><strong>Suits:</strong> a quick log of hours on a site visit or a task, to total up later.</li>
            <li>
              <strong>Doesn&rsquo;t suit:</strong> recording attendance for a team. It does not confirm who clocked in or
              where, and the entries sit in one browser.
            </li>
            <li>
              <strong>Doesn&rsquo;t suit:</strong> payroll or client billing on its own, where hours need a worker ID, a
              project and an approval.
            </li>
          </ul>

          <h2>From a personal log to a timesheet you can bill from</h2>
          <p>
            A clock tells you how long someone worked. Payroll and invoicing also need to know who, on which project, and
            whether the client approved the hours. If you supply workers to clients, see{" "}
            <a href="/timesheet-software-construction-uae">timesheet software for UAE construction and manpower</a>, which
            records attendance once and turns it into approved hours, payroll and invoices. For the layout clients expect,
            use the <a href="/tools/construction-timesheet-template">free labour supply timesheet template</a>, and read{" "}
            <a href="/blog/employee-time-recording-software-uae">what employee time recording software should do</a>.
          </p>

          <h2>Keeping accurate time records</h2>
          <ul>
            <li>Clock in and out at the moment you start and stop, rather than filling it in later from memory.</li>
            <li>Add a short note for the site or task so each entry can be matched to a project afterwards.</li>
            <li>Download a CSV at the end of each week, in case your browser data is cleared.</li>
            <li>For overtime, note the daily and weekly limits in <a href="/blog/uae-overtime-rules-construction-workers">UAE overtime rules for construction workers</a>.</li>
          </ul>
        </>
      }
      next={{
        title: "Record hours for a whole workforce, not just yourself.",
        body: "Timesheet software captures attendance against each worker, routes it to client approval and feeds the same hours into payroll and invoices.",
        href: "/timesheet-software-construction-uae",
        label: "See timesheet software",
      }}
      faqs={FAQS}
    />
  );
}
