import {
  ArrowRight,
  BedDouble,
  Bot,
  Check,
  FileScan,
  FileSpreadsheet,
  Gauge,
  HardHat,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { JsonLd, faqLd } from "@/lib/seo/jsonld";
import { BlogCard } from "@/app/(marketing)/blog/blog-card";
import { POSTS } from "@/app/(marketing)/blog/posts";
import { INDUSTRIES_DATA } from "@/app/(marketing)/industries/industries-data";
import { TOOLS } from "@/app/(marketing)/tools/tools-data";
import { CAPABILITIES, CHALLENGES, DEEP_DIVES, FAQS, FACTS, PORTALS, SITE } from "./content";
import { SiteHeader, SiteFooter } from "./site-chrome";
import { MobileDemoBar } from "./mobile-demo-bar";
import { Walkthrough } from "./walkthrough";
import {
  ACCENTS,
  Band,
  BeforeAfter,
  Bento,
  CodeCard,
  Faq,
  LinkCards,
  NextStep,
  ProofStrip,
  SectionHead,
  ShowcaseCta,
  ShowcaseHero,
  ShowcaseRoot,
  Tile,
  tileParts as T,
} from "./showcase/showcase";
import { shot } from "./showcase/showcase-page";
import s from "./welcome.module.css";
import h from "./home.module.css";

// A real file exported from the product's demo data (sample figures, not a real company).
const SIF_LINES = [
  { kind: "EDR", text: ",17395208112895,302420101,AE210247672661146149039,2026-09-01,2026-09-30,30,1450.00,150.00,2" },
  { kind: "EDR", text: ",17114994887262,309020101,AE770901753264533355832,2026-09-01,2026-09-30,30,1350.00,212.50,1" },
  { kind: "gap", text: "… 32 more employee records" },
  { kind: "SCR", text: ",0000123,302620101,2026-10-21,0442,092026,34,64752.97,AED,AE900261012345678901234" },
] as const;

const WALK = [
  { title: "Hours come in", body: "The site workbook, manual entry or a supplier's submission, reconciled in one place.", ...shot("sol-ts-client.webp", 1400, 800, "A September client timesheet with each worker's daily hours and approval status.") },
  { title: "A supervisor approves", body: "Overtime and exceptions are flagged, and sign-off happens in one queue with an audit trail.", ...shot("wps-approval.webp", 694, 390, "The approvals inbox with a payroll run waiting for a decision, with Send back and Approve buttons.") },
  { title: "Payroll runs from the same hours", body: "Overtime, loans and gratuity applied the same way every month, then a second person approves.", ...shot("wps-run-main.webp", 1400, 1085, "An approved payroll run with net pay, headcount and the review, submit, approve and pay steps.") },
  { title: "Invoices and the WPS file follow", body: "The same approved hours become client invoices, and the bank file is exported from the run.", ...shot("sol-billing.webp", 1400, 940, "The billing overview with invoices by client, paid and overdue.") },
];

const CMP_ROWS = [
  ["Hours to invoice", "Retyped into a billing sheet", "Usually out of scope", "Invoices from the same approved hours"],
  ["WPS salary file", "Built by hand each month", "Varies by product", "Exported from the approved payroll run"],
  ["Visa and ID expiries", "A calendar someone has to check", "Often a basic expiry field", "Alerts, with fields read from the scan"],
  ["Camps and transport", "A separate sheet or phone calls", "Not covered", "Bed-level occupancy and pickup routes"],
  ["Subcontractor crews", "Forwarded spreadsheets", "Not covered", "A supplier portal for demands, hours and payments"],
  ["Who changed what", "Hard to trace", "Varies by product", "Every change in the audit log"],
] as const;

const AFTER = [
  "Hours reconciled from any source, once",
  "Expiry alerts well before the fine",
  "Payroll and the WPS file from the record",
  "Approved hours billed, not forgotten",
  "Live occupancy and routes by site",
  "Suppliers submit through their portal",
];

const link = { fontWeight: 600, color: "var(--primary)" } as const;
const more = { ...link, display: "inline-flex", alignItems: "center", gap: 6 } as const;

export default function WelcomePage() {
  const latest = [...POSTS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <div id="top" className={s.page}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <JsonLd data={faqLd(FAQS)} />
      <SiteHeader logoHref="#top" />

      <main id="main">
        <ShowcaseRoot accent={ACCENTS.indigo}>
          <ShowcaseHero
            pill="AI document extraction for passports, visas & Emirates IDs"
            pillIcon={<Sparkles size={14} aria-hidden />}
            title={
              <>
                Your workforce, from <em>timesheet</em> to payday.
              </>
            }
            lead={`${SITE.name} runs your manpower business in one place: hours, approvals, payroll with WPS, client invoices, camps, transport and documents.`}
            ticks={["Bring your existing Excel timesheets, no re-keying", "A WPS file built from approved payroll", "From AED 500 a month, hosting included"]}
            secondaryCta={{ href: "#how", label: "See how it works" }}
            image={shot("sol-erp-dash.webp", 1400, 940, "The ManpowerSync dashboard for a 34-worker supplier: workforce total, deployment at 74%, active clients and what needs attention today.")}
            badge={{ icon: <ShieldCheck size={18} aria-hidden />, title: "One audit log", sub: "Every change recorded" }}
            slice={{
              label: "Workforce · today",
              amount: "34 workers",
              meta: "25 deployed · 9 on bench",
              steps: [
                { name: "Hours", state: "done" },
                { name: "Payroll", state: "done" },
                { name: "Billing", state: "done" },
                { name: "Compliance", state: "now" },
              ],
              button: "Open dashboard",
              icon: <Gauge size={16} aria-hidden />,
            }}
          />
          <ProofStrip items={FACTS} />

          <Band>
            <div id="how" />
            <SectionHead eyebrow="How it works" title="Enter hours once. Everything else follows." lead="Four real screens, in the order a month actually runs. Pick one, or let it play." />
            <Walkthrough steps={WALK} />
          </Band>

          <Band soft>
            <div className={h.live}>
              <div className={h.liveText}>
                <SectionHead eyebrow="At a glance" title="What needs you today, on one screen." />
                <p>Headcount, who is deployed, what is overdue and what is waiting for approval, without opening four spreadsheets.</p>
              </div>
              <div className={h.liveGrid}>
                <div className={h.liveTile}>
                  <span className={h.liveLabel}>Total workforce</span>
                  <b className={h.liveValue}>34</b>
                  <span className={h.liveNote}>workers on record</span>
                </div>
                <div className={h.liveTile}>
                  <span className={h.liveLabel}>Deployment</span>
                  <b className={h.liveValue}>74%</b>
                  <span className={h.liveNote}>25 of 34 deployed</span>
                </div>
                <div className={h.liveTile}>
                  <span className={h.liveLabel}>Outstanding invoices</span>
                  <b className={h.liveValue}>AED 56,910</b>
                  <span className={`${h.liveNote} ${h.liveWarn}`}>1 overdue</span>
                </div>
                <div className={h.liveTile}>
                  <span className={h.liveLabel}>Waiting for approval</span>
                  <b className={h.liveValue}>10</b>
                  <span className={h.liveNote}>expenses, supplier bills, demand quantities</span>
                </div>
                <p className={h.liveCap}>Figures from the demo company. Your dashboard shows your own records.</p>
              </div>
            </div>
          </Band>

          <Band>
            <SectionHead
              eyebrow="Sound familiar?"
              title="Spreadsheets weren't built to run a workforce."
              lead="Supplying hundreds of workers to client sites is a different business from employing them in one office. Most HRMS and ERP tools stop at employee records and payroll, so everything else ends up in spreadsheets, WhatsApp groups and inboxes."
            />
            <BeforeAfter
              before={{ tag: "Spreadsheets and inboxes", title: "Everything chased by hand", items: CHALLENGES.map((c) => c.title) }}
              after={{ tag: `With ${SITE.name}`, title: "One set of records", items: AFTER }}
            />
          </Band>

          <Band soft>
            <SectionHead eyebrow="The platform" title="One platform, built around how manpower suppliers work." lead="Operations, HR, payroll and finance share one set of records, so the hours your supervisors approve are the hours you bill and the hours you pay." />
            <Bento>
              <Tile tone="dark" span2 row2 icon={<FileSpreadsheet size={22} aria-hidden />} title={CAPABILITIES[0].title} body={CAPABILITIES[0].body}>
                <T.List items={CAPABILITIES[0].points} />
                <T.Media>
                  <T.Img fade {...shot("sol-ts-client.webp", 1400, 800, "A client timesheet with a day-by-day grid of hours per worker.")} />
                </T.Media>
              </Tile>
              <Tile tone="tint" span2 icon={<Wallet size={22} aria-hidden />} title={CAPABILITIES[1].title} body={CAPABILITIES[1].body}>
                <T.Chips items={CAPABILITIES[1].points} />
              </Tile>
              <Tile tone="sky" icon={<Receipt size={22} aria-hidden />} title={CAPABILITIES[2].title} body={CAPABILITIES[2].body}>
                <T.List items={CAPABILITIES[2].points} />
              </Tile>
              <Tile tone="violet" icon={<HardHat size={22} aria-hidden />} title={CAPABILITIES[3].title} body={CAPABILITIES[3].body}>
                <T.List items={CAPABILITIES[3].points} />
              </Tile>
              <Tile span2 icon={<Bot size={22} aria-hidden />} title={DEEP_DIVES[2].title} body={DEEP_DIVES[2].body}>
                <T.Chips items={DEEP_DIVES[2].points} />
                <T.Media>
                  <T.Img fade {...shot("sol-assistant.webp", 1400, 940, "The assistant panel listing what needs attention today, with Open buttons.")} />
                </T.Media>
              </Tile>
              <Tile icon={<FileScan size={22} aria-hidden />} title={DEEP_DIVES[0].title} body={DEEP_DIVES[0].body}>
                <T.List items={DEEP_DIVES[0].points} />
              </Tile>
              <Tile icon={<BedDouble size={22} aria-hidden />} title={DEEP_DIVES[1].title} body={DEEP_DIVES[1].body}>
                <T.List items={DEEP_DIVES[1].points} />
              </Tile>
            </Bento>
            <div style={{ marginTop: 28 }}>
              <NextStep title="Plus camps, transport, letters, NOCs, sales and an audit trail for all of it." body="More than 30 modules, one login, and permissions that decide who sees what." href="/features" label="See every module" />
            </div>
          </Band>

          <Band>
            <SectionHead eyebrow="A payroll file you can inspect" title="The WPS file, built from the record." lead="Bank and routing details come straight from each employee's record, and the control total ties to the lines." />
            <div style={{ display: "grid", gap: 22, maxWidth: 920, margin: "0 auto" }}>
              <CodeCard label="The first lines of a WPS SIF file: employee records followed by one control record with the count and total." lines={[...SIF_LINES]} />
              <NextStep title="Already have a file? Check it free." body="Paste or upload a SIF file and see totals, IBAN, date and format problems before your bank does." href="/tools/wps-sif-file-checker" label="Open the SIF checker" />
            </div>
          </Band>

          <Band>
            <SectionHead eyebrow="A day in the life" title="Three people, one set of records." />
            <div className={h.days}>
              <article className={h.day}>
                <div className={h.dayShot}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
                  <img src="/brand-assets/wps-approval.webp" width={694} height={390} alt="The approvals inbox with an item waiting for a decision." loading="lazy" decoding="async" />
                </div>
                <div className={h.dayBody}>
                  <span className={h.dayWho}>Supervisor · morning</span>
                  <h3>Signs off the site&rsquo;s hours</h3>
                  <p>Opens the approval queue, sees the flagged overtime, and approves in one pass. Every change is recorded.</p>
                </div>
              </article>
              <article className={h.day}>
                <div className={h.dayShot}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
                  <img src="/brand-assets/sol-billing.webp" width={1400} height={940} alt="The billing overview with invoices by client." loading="lazy" decoding="async" />
                </div>
                <div className={h.dayBody}>
                  <span className={h.dayWho}>Finance · month end</span>
                  <h3>Invoices and payroll are already there</h3>
                  <p>Approved hours have become client invoices and a payroll run. Finance reviews, approves and exports the WPS file.</p>
                </div>
              </article>
              <article className={h.day}>
                <div className={`${h.dayShot} ${h.dayShotPhone}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
                  <img src="/brand-assets/sol-ess-pay.webp" width={780} height={490} alt="The employee portal on a phone, listing a September payslip." loading="lazy" decoding="async" />
                </div>
                <div className={h.dayBody}>
                  <span className={h.dayWho}>Worker · payday</span>
                  <h3>Opens the payslip on a phone</h3>
                  <p>No app to install and no call to HR. The payslip shows the same figures the payroll run approved.</p>
                </div>
              </article>
            </div>
          </Band>

          <Band soft>
            <SectionHead eyebrow="How it compares" title="Excel, a general HR tool, or a manpower ERP." />
            <div className={h.cmpWrap}>
              <table className={h.cmp}>
                <thead>
                  <tr>
                    <th scope="col">What you need</th>
                    <th scope="col">Excel</th>
                    <th scope="col">General HRMS</th>
                    <th scope="col" className={h.cmpUs}>
                      {SITE.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CMP_ROWS.map(([need, a, b, c]) => (
                    <tr key={need}>
                      <th scope="row">{need}</th>
                      <td>{a}</td>
                      <td>{b}</td>
                      <td className={h.cmpUs}>{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "20px 0 0", fontSize: 15.5, color: "var(--slate)" }}>
              Full write-ups: <a href="/compare/manpowersync-vs-excel" style={link}>ManpowerSync vs Excel</a> and{" "}
              <a href="/compare/manpower-erp-vs-hrms" style={link}>Manpower ERP vs a general HRMS</a>.
            </p>
          </Band>

          <Band>
            <SectionHead eyebrow="Industries" title="Built for the way your sector staffs." lead="The same platform, framed around what differs in each line of manpower supply." />
            <LinkCards cards={INDUSTRIES_DATA.map((i) => ({ href: `/industries/${i.slug}`, title: i.name, body: i.description }))} />
          </Band>

          <Band soft>
            <SectionHead eyebrow="Try it free" title="Useful before you sign anything." lead="Free tools that run in your browser, with nothing uploaded or stored." />
            <LinkCards cards={TOOLS.map((t) => ({ href: `/tools/${t.slug}`, title: t.label, body: t.description }))} />
          </Band>

          <Band>
            <SectionHead eyebrow="Pricing" title="Simple plans, hosting included." lead="Priced by the number of members. Pay annually and get 12 months for the price of 11." />
            <div className={h.price}>
              <article className={h.plan}>
                <span className={h.planName}>Basic</span>
                <div className={h.planPrice}>
                  AED 500 <small>/ month</small>
                </div>
                <p className={h.planFor}>Up to 200 members</p>
                <ul>
                  {["Timesheets, payroll and WPS, billing", "Employee portal", "Hosting and database", "Email support"].map((x) => (
                    <li key={x}>
                      <Check size={16} aria-hidden /> {x}
                    </li>
                  ))}
                </ul>
              </article>
              <article className={`${h.plan} ${h.planPro}`}>
                <span className={h.planName}>Pro</span>
                <div className={h.planPrice}>
                  AED 1,000 <small>/ month</small>
                </div>
                <p className={h.planFor}>Up to 500 members</p>
                <ul>
                  {["Everything in Basic", "Supplier portal", "Dedicated account manager", "Faster email support"].map((x) => (
                    <li key={x}>
                      <Check size={16} aria-hidden /> {x}
                    </li>
                  ))}
                </ul>
              </article>
              <article className={h.plan}>
                <span className={h.planName}>Custom</span>
                <div className={h.planPrice}>Quoted</div>
                <p className={h.planFor}>For larger or more complex operations</p>
                <ul>
                  {["Sized around your workforce", "Quoted around your operation"].map((x) => (
                    <li key={x}>
                      <Check size={16} aria-hidden /> {x}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <p className={h.priceNote}>
              <a href="/pricing" style={more}>See full pricing and what&rsquo;s included <ArrowRight size={14} aria-hidden /></a>
            </p>
          </Band>

          <Band soft>
            <SectionHead eyebrow="Three portals" title="Everyone who touches the work, on the same page." lead="Your team, your workers and your subcontractors each get a view built for them, all reading from the same records." />
            <LinkCards
              cards={[
                { href: "/manpower-erp-uae", title: PORTALS[0].title, body: PORTALS[0].body },
                { href: "/employee-self-service-portal-uae", title: PORTALS[1].title, body: PORTALS[1].body },
                { href: "/supplier-portal-software-uae", title: PORTALS[2].title, body: PORTALS[2].body },
              ]}
            />
          </Band>

          <Band>
            <SectionHead eyebrow="From the blog" title="Guides for UAE manpower suppliers." />
            <div className={h.guides}>
              {latest.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
            <p style={{ margin: "24px 0 0" }}>
              <a href="/blog" style={more}>
                Read all guides <ArrowRight size={14} aria-hidden />
              </a>
            </p>
          </Band>

          <Band soft>
            <SectionHead eyebrow="FAQ" title="Questions, answered." />
            <Faq items={FAQS} />
          </Band>

          <ShowcaseCta title="Close next month in days, not weeks." lead={`See ${SITE.name} with your own timesheet workbook. A 30-minute call is all it takes.`} />
        </ShowcaseRoot>
      </main>
      <SiteFooter />
      <MobileDemoBar />
    </div>
  );
}
