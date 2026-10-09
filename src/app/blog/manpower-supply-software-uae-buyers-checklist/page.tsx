import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "manpower-supply-software-uae-buyers-checklist")!;
const URL = `https://manpowersync.com/blog/${post.slug}`;

const SEO_TITLE = "Manpower Supply Software UAE: 12 Questions Before You Buy";

const FAQS = [
  {
    "q": "What is manpower supply software?",
    "a": "Manpower supply software, sometimes called a labour supply ERP, manages the whole cycle of a company that supplies workers to clients: employee and document records, attendance and timesheets, payroll and the WPS file, client billing, camps and transport, and the compliance deadlines around visas and permits."
  },
  {
    "q": "How much does manpower supply software cost in the UAE?",
    "a": "Pricing models vary: some charge per user, some per worker, some a one-time licence. Ask what is included, such as hosting, setup, data migration, support and any AI usage, because the headline price rarely shows the full yearly cost."
  },
  {
    "q": "Can I move my existing Excel data into the software?",
    "a": "A good system imports your employee lists, sites and existing timesheet workbook, shows what it will change before it does, and lets you undo an import. Ask for a demo using your own files."
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
          Choosing software for a manpower or labour supply business is different from choosing
          general accounting software. Your costs sit in workers, documents, camps and buses, and
          your revenue comes from timesheets that clients must sign. A system that handles one of
          those well and the others badly leaves you working in spreadsheets anyway.
        </p>
        <p>
          These twelve questions are the ones worth asking every vendor, including us. Ask for a
          demo using your own timesheet workbook and employee list, not a prepared sample.
        </p>

        <h2>Payroll and compliance</h2>
        <h3>1. Does it produce a WPS file your bank accepts?</h3>
        <p>Payroll that cannot export a correct Salary Information File means retyping salaries every month. Ask how the file is built from the employee record, and what checks run before export. Our guide to <a href="/blog/wps-sif-rejection-reasons-uae">why WPS files get rejected</a> lists what a good system should catch.</p>
        <h3>2. Does it track every document expiry and warn you in time?</h3>
        <p>Visas, Emirates IDs, labour cards, passports, medical certificates and insurance all expire on different dates. Ask whether alerts are automatic, who receives them and how early. The <a href="/blog/visa-emirates-id-expiry-compliance-checklist">expiry compliance checklist</a> shows what needs tracking.</p>
        <h3>3. How does it read documents and fill in employee details?</h3>
        <p>Typing passport and Emirates ID details by hand is slow and error-prone. Ask whether the system can read a scanned document, show what it read for you to check, and never overwrite details already on file without asking.</p>
        <h3>4. Can it calculate pay, overtime, absences and deductions the way your contracts work?</h3>
        <p>Rules differ between companies: free absence days, deduction per day, gas or food charges. Ask whether these are settings you control, or custom work you pay for each time.</p>

        <h2>Timesheets and billing</h2>
        <h3>5. Can it use your existing timesheet format?</h3>
        <p>If you have to change the sheet your clients already approve, you will fight with the client instead of the software. Ask to upload your current workbook as it is. See what a <a href="/blog/construction-timesheet-format-labour-supply-uae">client-ready timesheet</a> contains.</p>
        <h3>6. Does billing come from approved timesheets, with different rates by trade and project?</h3>
        <p>Invoices should be built from the same hours as payroll, so the two never disagree. Ask how rates are stored per client, project and trade, and how changes are handled mid-month. Our guide to <a href="/blog/how-to-price-manpower-supply-uae-hourly-rate">pricing manpower supply</a> explains why rates should be set per trade.</p>

        <h2>Operations</h2>
        <h3>7. Does it cover camps, beds and transport, or only payroll?</h3>
        <p>If accommodation and buses are tracked on paper, you still cannot see what a worker really costs. Ask whether beds, rooms, vehicles and routes sit alongside the workforce records.</p>
        <h3>8. Can you import your current data, and undo it if something is wrong?</h3>
        <p>Migration is where most projects stall. Ask how employees, sites and timesheets are imported, whether you see a preview before anything is saved, and whether a whole import can be reversed.</p>
        <h3>9. Can it issue letters, NOCs and salary certificates on your letterhead?</h3>
        <p>These are small tasks that take up hours every week. Ask whether letters come from templates, are numbered and stored, and can be issued on the letterhead of the right company when you operate more than one.</p>

        <h2>Access, security and support</h2>
        <h3>10. Who can see what, and is every change recorded?</h3>
        <p>Salaries and passport copies are sensitive. Ask for role-based permissions so each person sees only what they need, and an audit log of who changed what and when. If you run several companies, ask how their data is kept apart.</p>
        <h3>11. Are there portals for your employees and subcontractors?</h3>
        <p>Workers and supplier companies ask the same questions repeatedly: where is my payslip, which of my people are on this project. Portals answer them without a phone call. Ask what each portal shows and who controls it.</p>
        <h3>12. What does it really cost, and what support do you get?</h3>
        <p>Ask whether the price covers hosting, setup, data migration and any AI usage, how extra workers are charged, and how fast support replies. A named contact and a scheduled review matter more than a long feature list. Our <a href="/pricing">pricing page</a> shows how we answer this.</p>

        <h2>Red flags</h2>
        <ul>
          <li>The demo only uses a prepared sample and never your own files.</li>
          <li>Payroll, timesheets and billing live in separate tools that you must reconcile by hand.</li>
          <li>Customisation is quoted per request for things you consider standard.</li>
          <li>No audit log or role-based access to salary information.</li>
          <li>Vague answers about what happens to your data if you leave.</li>
        </ul>

        <h2>How ManpowerSync answers these</h2>
        <p>
          ManpowerSync is built for UAE manpower suppliers: WPS payroll, timesheets and client
          billing, document expiry alerts, camps and transport, letters and portals, in one system
          with role-based permissions and an audit log. Read the{" "}
          <a href="/manpower-erp-uae">manpower ERP overview</a>, see{" "}
          <a href="/wps-payroll-software-uae">WPS payroll</a> and{" "}
          <a href="/camp-accommodation-management-software-uae">camp management</a>, or book a call
          and bring your own timesheet workbook.
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
