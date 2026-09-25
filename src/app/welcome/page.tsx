import {
  ArrowRight,
  BedDouble,
  Bus,
  Check,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  FileText,
  HardHat,
  IdCard,
  LayoutDashboard,
  Mail,
  TrendingDown,
  Plus,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import {
  CAPABILITIES,
  CHALLENGES,
  DEEP_DIVES,
  FACTS,
  FAQS,
  FOOTER,
  INDUSTRIES,
  NAV,
  PORTALS,
  SITE,
  STEPS,
  appHref,
  demoHref,
} from "./content";
import { MobileMenu } from "./mobile-menu";
import s from "./welcome.module.css";

const CAP_ICONS = { clock: Clock, wallet: Wallet, receipt: Receipt, hardhat: HardHat };
const CHALLENGE_ICONS = {
  sheet: FileSpreadsheet,
  id: IdCard,
  wallet: Wallet,
  leak: TrendingDown,
  bed: BedDouble,
  mail: Mail,
};

function Logo() {
  return (
    <a href="#top" className={s.logo} aria-label={`${SITE.name} home`}>
      <span className={s.logoMark} aria-hidden>
        <span style={{ background: "var(--yellow)" }} />
        <span style={{ background: "var(--pink)" }} />
        <span style={{ background: "var(--teal)" }} />
        <span style={{ background: "#fff" }} />
      </span>
      {SITE.name}
    </a>
  );
}

function Decorations() {
  const dots: [string, string, string, string][] = [
    ["8%", "18%", "var(--yellow)", "-8deg"],
    ["14%", "62%", "var(--pink)", "12deg"],
    ["4%", "84%", "var(--teal)", "6deg"],
    ["88%", "14%", "var(--orange)", "10deg"],
    ["92%", "48%", "var(--purple)", "-12deg"],
    ["82%", "76%", "var(--green)", "4deg"],
  ];
  return (
    <div aria-hidden>
      {dots.map(([left, top, bg, r]) => (
        <span
          key={left + top}
          className={s.dot}
          style={{ left, top, background: bg, ["--r" as string]: r } as React.CSSProperties}
        />
      ))}
      <svg className={s.mesh} style={{ left: "-40px", top: "30%" }} width="260" height="260" viewBox="0 0 260 260" fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M0 ${30 * i} Q130 ${30 * i + 60} 260 ${30 * i}`} stroke="#7b8ad4" strokeWidth="1" />
        ))}
      </svg>
      <svg className={s.mesh} style={{ right: "-40px", top: "8%" }} width="260" height="260" viewBox="0 0 260 260" fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${30 * i} 0 Q${30 * i - 60} 130 ${30 * i} 260`} stroke="#7b8ad4" strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
}

const ROWS = [
  { i: "RK", name: "Rajesh Kumar", trade: "Steel fixer", site: "Site 14 · Al Quoz", hrs: 208, ot: 16, status: "Approved", tone: s.tagGreen, bg: "var(--tint-peach)" },
  { i: "MA", name: "Mohammed Ali", trade: "Mason", site: "Site 14 · Al Quoz", hrs: 208, ot: 22, status: "Approved", tone: s.tagGreen, bg: "var(--tint-sky)" },
  { i: "JS", name: "Joseph Santos", trade: "Electrician", site: "Tower B · JVC", hrs: 196, ot: 8, status: "Review OT", tone: s.tagOrange, bg: "var(--tint-mint)" },
  { i: "SH", name: "Sanjay Hegde", trade: "Welder", site: "Plant 3 · ICAD", hrs: 212, ot: 30, status: "Pending", tone: s.tagPurple, bg: "var(--tint-lavender)" },
  { i: "AB", name: "Arif Bhuiyan", trade: "Scaffolder", site: "Tower B · JVC", hrs: 184, ot: 0, status: "Approved", tone: s.tagGreen, bg: "var(--tint-rose)" },
];

function HeroMock() {
  const side = [
    { icon: LayoutDashboard, label: "Dashboards" },
    { icon: Clock, label: "Timesheets", active: true },
    { icon: ClipboardCheck, label: "Approvals" },
    { icon: Users, label: "Employees" },
    { icon: Wallet, label: "Payroll" },
    { icon: Receipt, label: "Invoices" },
  ];
  const ops = [
    { icon: BedDouble, label: "Accommodation" },
    { icon: Bus, label: "Transport" },
    { icon: FileText, label: "Documents" },
  ];
  return (
    <div className={s.mock} role="img" aria-label="Product screenshot: May timesheets for a construction client, showing workers, hours, overtime and approval status">
      <div className={s.mockBar}>
        <div className={s.mockDots}>
          <span />
          <span />
          <span />
        </div>
        <span className={s.mockUrl}>app / timesheets / may-2026</span>
      </div>
      <div className={s.mockBody}>
        <aside className={s.mockSide}>
          {side.map(({ icon: Icon, label, active }) => (
            <div key={label} className={`${s.mockSideItem} ${active ? s.mockSideActive : ""}`}>
              <Icon size={15} /> {label}
            </div>
          ))}
          <div className={s.mockSideLabel}>Operations</div>
          {ops.map(({ icon: Icon, label }) => (
            <div key={label} className={s.mockSideItem}>
              <Icon size={15} /> {label}
            </div>
          ))}
        </aside>
        <div className={s.mockMain}>
          <div className={s.mockHead}>
            <div>
              <p className={s.mockTitle}>May 2026 timesheets</p>
              <span className={s.mockMeta}>Northgate Contracting · 3 sites · uploaded 2 hours ago</span>
            </div>
            <span className={`${s.tag} ${s.tagBlue}`}>Ready to invoice</span>
          </div>
          <div className={s.mockStats}>
            <div className={s.mockStat}>
              <b>412</b>
              <span>Workers</span>
            </div>
            <div className={s.mockStat}>
              <b>84,216</b>
              <span>Regular hours</span>
            </div>
            <div className={s.mockStat}>
              <b>6,930</b>
              <span>Overtime hours</span>
            </div>
            <div className={s.mockStat}>
              <b>97%</b>
              <span>Approved</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th className={s.mockHideSm}>Trade</th>
                  <th className={s.mockHideSm}>Site</th>
                  <th className={s.num}>Hours</th>
                  <th className={s.num}>OT</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <span className={s.person}>
                        <span className={s.avatar} style={{ background: r.bg }}>
                          {r.i}
                        </span>
                        {r.name}
                      </span>
                    </td>
                    <td className={s.mockHideSm}>{r.trade}</td>
                    <td className={s.mockHideSm}>{r.site}</td>
                    <td className={s.num}>{r.hrs}</td>
                    <td className={s.num}>{r.ot}</td>
                    <td>
                      <span className={`${s.tag} ${r.tone}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapabilityMini({ index }: { index: number }) {
  const minis = [
    [
      ["MAY-25.xlsx", <span key="t" className={`${s.tag} ${s.tagGreen}`}>Imported</span>],
      ["APR-25.xlsx", <span key="t" className={`${s.tag} ${s.tagGreen}`}>Imported</span>],
      ["Overtime flagged", <span key="t" className={`${s.tag} ${s.tagOrange}`}>12 rows</span>],
    ],
    [
      ["May payroll run", <span key="t" className={`${s.tag} ${s.tagPurple}`}>Awaiting approval</span>],
      ["Net pay", <b key="t">AED 1,284,560</b>],
      ["WPS file", <span key="t" className={`${s.tag} ${s.tagGreen}`}>Generated</span>],
    ],
    [
      ["INV-2026-0418", <b key="t">AED 642,300</b>],
      ["VAT 5%", <span key="t" className={s.miniMuted}>AED 32,115</span>],
      ["Status", <span key="t" className={`${s.tag} ${s.tagBlue}`}>Sent</span>],
    ],
    [
      ["DR-231 · 40 masons", <span key="t" className={`${s.tag} ${s.tagPurple}`}>Mobilising</span>],
      ["DR-228 · 12 welders", <span key="t" className={`${s.tag} ${s.tagGreen}`}>On site</span>],
      ["Q-1187 · MEP crew", <span key="t" className={`${s.tag} ${s.tagOrange}`}>Quoted</span>],
    ],
  ] as const;
  return (
    <div className={s.miniMock} aria-hidden>
      {minis[index].map(([label, value]) => (
        <div key={label} className={s.miniRow}>
          <span>{label}</span>
          {value}
        </div>
      ))}
    </div>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 0)
    return (
      <div className={s.stepVisual} aria-hidden>
        <div className={s.stepLine}>
          <span>Site workbook</span>
          <span className={`${s.tag} ${s.tagBlue}`}>Excel</span>
        </div>
        <div className={s.stepLine}>
          <span>Supplier crew · Al Madina</span>
          <span className={`${s.tag} ${s.tagRose}`}>Portal</span>
        </div>
        <div className={s.stepLine}>
          <span>Manual adjustments</span>
          <span className={`${s.tag} ${s.tagPurple}`}>3 entries</span>
        </div>
      </div>
    );
  if (index === 1)
    return (
      <div className={s.stepVisual} aria-hidden>
        <div className={s.stepLine}>
          <span>Overtime over 60 hrs</span>
          <span className={`${s.tag} ${s.tagOrange}`}>4 flagged</span>
        </div>
        <div className={s.stepLine}>
          <span>Site 14 · May</span>
          <span className={`${s.tag} ${s.tagGreen}`}>Approved</span>
        </div>
        <div className={s.stepLine}>
          <span className={s.miniMuted}>Approved by Operations · 09:42</span>
        </div>
      </div>
    );
  return (
    <div className={s.stepVisual} aria-hidden>
      <div className={s.stepLine}>
        <span>Client invoice</span>
        <span className={`${s.tag} ${s.tagBlue}`}>Sent</span>
      </div>
      <div className={s.stepLine}>
        <span>Payroll run</span>
        <span className={`${s.tag} ${s.tagGreen}`}>Paid</span>
      </div>
      <div className={s.stepLine}>
        <span>WPS / SIF file</span>
        <span className={`${s.tag} ${s.tagGreen}`}>Uploaded</span>
      </div>
    </div>
  );
}

function DiveVisual({ kind }: { kind: "documents" | "camps" | "assistant" }) {
  if (kind === "documents")
    return (
      <div className={`${s.diveVisual} ${s["tint-sky"]}`} aria-hidden>
        <div className={s.diveCard}>
          <div className={s.scan}>
            <span className={s.scanThumb} />
            <div>
              <b>passport_scan.pdf</b>
              <div className={s.miniMuted} style={{ fontSize: 13 }}>
                <Sparkles size={13} style={{ verticalAlign: "-2px" }} /> 6 fields extracted
              </div>
            </div>
          </div>
          {[
            ["Full name", "Rajesh Kumar"],
            ["Passport no.", "Z4821••••"],
            ["Nationality", "India"],
            ["Visa expiry", <span key="v" className={`${s.tag} ${s.tagOrange}`}>in 28 days</span>],
            ["Emirates ID", "784-19••-•••••••-2"],
          ].map(([k, v]) => (
            <div key={String(k)} className={s.field}>
              <span className={s.fieldLabel}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (kind === "camps") {
    const rooms = [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1],
    ];
    return (
      <div className={`${s.diveVisual} ${s["tint-mint"]}`} aria-hidden>
        <div className={s.diveCard}>
          <div className={s.stepLine}>
            <b>Sonapur Camp · Block C</b>
            <span className={`${s.tag} ${s.tagGreen}`}>81% occupied</span>
          </div>
          <div className={s.bar}>
            <span style={{ width: "81%" }} />
          </div>
          <div className={s.rooms}>
            {rooms.map((beds, i) => (
              <div key={i} className={s.room}>
                C-{101 + i}
                <div className={s.beds}>
                  {beds.map((b, j) => (
                    <span key={j} className={`${s.bed} ${b ? s.bedFull : ""}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className={s.stepLine} style={{ marginTop: 16 }}>
            <span>
              <Bus size={14} style={{ verticalAlign: "-2px" }} /> Route 4 · Sonapur → Al Quoz
            </span>
            <span className={s.miniMuted}>05:30 · 48 seats</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className={`${s.diveVisual} ${s["tint-lavender"]}`} aria-hidden>
      <div className={`${s.diveCard} ${s.chat}`}>
        <div className={s.bubbleUser}>Which visas expire in the next 30 days?</div>
        <div className={s.bubbleBot}>
          7 employees have visas expiring before 30 June:
          <ul>
            <li>
              <span className={s.linkish}>Rajesh Kumar</span> · 22 Jun
            </li>
            <li>
              <span className={s.linkish}>Joseph Santos</span> · 25 Jun
            </li>
            <li>
              <span className={s.linkish}>+5 more</span> in Documents
            </li>
          </ul>
        </div>
        <div className={s.bubbleUser}>Draft renewal NOCs for them.</div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div id="top" className={s.page}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>

      <header className={s.nav}>
        <div className={`${s.container} ${s.navInner}`}>
          <Logo />
          <nav aria-label="Primary">
            <ul className={s.navLinks}>
              {NAV.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className={s.navActions}>
            <a href={appHref("/login")} className={`${s.btn} ${s.btnGhost}`}>
              Sign in
            </a>
            <a href={demoHref} className={`${s.btn} ${s.btnPrimary}`}>
              Book a demo
            </a>
          </div>
          <MobileMenu />
        </div>
      </header>

      <main id="main">
        <section className={s.hero} aria-labelledby="hero-title">
          <Decorations />
          <div className={s.container}>
            <div className={s.heroInner}>
              <span className={s.pill}>
                <span className={s.pillBadge}>New</span>
                AI document extraction for passports, visas & Emirates IDs
              </span>
              <h1 id="hero-title" className={s.heroTitle}>
                Your workforce, from <em>timesheet</em> to payday.
              </h1>
              <p className={s.heroSub}>
                {SITE.name} runs your manpower business in one place: hours, approvals, payroll with WPS, client
                invoices, camps, transport and documents.
              </p>
              <div className={s.heroCtas}>
                <a href={demoHref} className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>
                  Book a demo <ArrowRight size={16} aria-hidden />
                </a>
                <a href="#how" className={`${s.btn} ${s.btnGhostOnDark} ${s.btnLg}`}>
                  See how it works
                </a>
              </div>
              <p className={s.heroNote}>Bring your existing Excel timesheets, no re-keying</p>
            </div>
            <div className={s.heroMockWrap}>
              <HeroMock />
            </div>
          </div>
        </section>
        <div className={s.heroSpacer} aria-hidden />

        <section className={s.strip} aria-label="Industries">
          <div className={s.container}>
            <p className={s.stripLabel}>Built for companies that supply and manage skilled labour</p>
            <ul className={s.stripList}>
              {INDUSTRIES.map((name) => (
                <li key={name}>
                  <HardHat size={16} aria-hidden /> {name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="challenges" className={`${s.section} ${s.sectionSurface}`} aria-labelledby="challenges-title">
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>The challenge</span>
              <h2 id="challenges-title" className={s.h2}>
                Generic HR software was never built for manpower supply.
              </h2>
              <p className={s.lead}>
                Supplying hundreds of workers to client sites is a different business from employing them in one
                office. Most HRMS and ERP tools stop at employee records and payroll, so everything else ends up in
                spreadsheets, WhatsApp groups and inboxes.
              </p>
            </div>
            <div className={s.challengeGrid}>
              {CHALLENGES.map((ch) => {
                const Icon = CHALLENGE_ICONS[ch.icon];
                return (
                  <article key={ch.title} className={s.challenge}>
                    <span className={s.challengeIcon}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <h3 className={s.h5}>{ch.title}</h3>
                    <p>{ch.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="product" className={s.section} aria-labelledby="product-title">
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>The platform</span>
              <h2 id="product-title" className={s.h2}>
                One platform, built around how manpower suppliers work.
              </h2>
              <p className={s.lead}>
                Operations, HR, payroll and finance share one set of records, so the hours your supervisors approve
                are the hours you bill and the hours you pay.
              </p>
            </div>
            <div className={s.capGrid}>
              {CAPABILITIES.map((c, i) => {
                const Icon = CAP_ICONS[c.icon];
                return (
                  <article key={c.title} className={`${s.card} ${s[`tint-${c.tint}`]}`}>
                    <span className={s.iconTile}>
                      <Icon size={22} aria-hidden />
                    </span>
                    <h3 className={s.h3}>{c.title}</h3>
                    <p className={s.cardBody}>{c.body}</p>
                    <ul className={s.checkList}>
                      {c.points.map((p) => (
                        <li key={p}>
                          <Check size={16} aria-hidden /> {p}
                        </li>
                      ))}
                    </ul>
                    <CapabilityMini index={i} />
                  </article>
                );
              })}
            </div>
            <div className={s.banner}>
              <div>
                <h3 className={s.h3}>Plus camps, transport, letters, NOCs, sales and an audit trail for all of it.</h3>
                <p className={s.cardBody}>
                  More than 30 modules, one login, and permissions that decide who sees what.
                </p>
              </div>
              <a href="#portals" className={`${s.btn} ${s.btnDark} ${s.btnLg}`}>
                Explore the portals <ArrowRight size={16} aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section id="how" className={`${s.section} ${s.sectionSurface}`} aria-labelledby="how-title">
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>How it works</span>
              <h2 id="how-title" className={s.h2}>
                Enter hours once. Everything else follows.
              </h2>
            </div>
            <ol className={s.steps} style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {STEPS.map((step, i) => (
                <li key={step.n} className={s.step}>
                  <span className={s.stepNum}>{step.n}</span>
                  <h3 className={s.h3} style={{ marginTop: 8 }}>
                    {step.title}
                  </h3>
                  <p className={s.cardBody} style={{ color: "var(--slate)" }}>
                    {step.body}
                  </p>
                  <StepVisual index={i} />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={s.section} aria-label="Features in detail">
          <div className={s.container}>
            {DEEP_DIVES.map((d, i) => (
              <div key={d.title} className={`${s.dive} ${i % 2 ? s.diveFlip : ""}`}>
                <div className={s.diveText}>
                  <span className={s.eyebrow}>{d.eyebrow}</span>
                  <h2 className={s.h2sm}>{d.title}</h2>
                  <p className={s.lead}>{d.body}</p>
                  <div className={s.chips}>
                    {d.points.map((p) => (
                      <span key={p} className={s.chip}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <DiveVisual kind={d.visual} />
              </div>
            ))}
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }} aria-label="At a glance">
          <div className={s.container}>
            <dl className={s.facts} style={{ margin: 0 }}>
              {FACTS.map((f) => (
                <div key={f.label} className={s.fact}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd style={{ margin: 0 }}>
                    <b>{f.value}</b>
                    <span>{f.label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="portals" className={`${s.section} ${s.sectionSurface}`} aria-labelledby="portals-title">
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>Three portals</span>
              <h2 id="portals-title" className={s.h2}>
                Everyone who touches the work, on the same page.
              </h2>
              <p className={s.lead}>
                Your team, your workers and your subcontractors each get a view built for them, all reading from the
                same records.
              </p>
            </div>
            <div className={s.portalGrid}>
              {PORTALS.map((p) => (
                <article key={p.title} className={`${s.card} ${s[`tint-${p.tint}`]}`}>
                  <h3 className={s.h3}>{p.title}</h3>
                  <p className={s.cardBody}>{p.body}</p>
                  <ul className={s.checkList}>
                    {p.points.map((pt) => (
                      <li key={pt}>
                        <Check size={16} aria-hidden /> {pt}
                      </li>
                    ))}
                  </ul>
                  <a href={p.href} className={s.portalCta}>
                    {p.cta} <ArrowRight size={14} aria-hidden />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className={s.section} aria-labelledby="faq-title">
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>FAQ</span>
              <h2 id="faq-title" className={s.h2}>
                Questions, answered.
              </h2>
            </div>
            <div className={s.faq}>
              {FAQS.map((f) => (
                <details key={f.q} className={s.faqItem}>
                  <summary>
                    {f.q}
                    <Plus size={20} aria-hidden />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={s.section} aria-labelledby="cta-title">
          <div className={s.container}>
            <div className={s.cta}>
              <Decorations />
              <h2 id="cta-title" className={s.h2}>
                Close next month in days, not weeks.
              </h2>
              <p className={s.lead}>
                See {SITE.name} with your own timesheet workbook. A 30-minute call is all it takes.
              </p>
              <div className={s.heroCtas}>
                <a href={demoHref} className={`${s.btn} ${s.btnOnDark} ${s.btnLg}`}>
                  Book a demo <ArrowRight size={16} aria-hidden />
                </a>
                <a href={appHref("/login")} className={`${s.btn} ${s.btnGhostOnDark} ${s.btnLg}`}>
                  Sign in
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.container}>
          <div className={s.footerGrid}>
            <div className={s.footerBrand}>
              <Logo />
              <p className={s.footerAbout}>
                Timesheets, payroll, billing and operations software for manpower suppliers in the UAE and GCC.
              </p>
            </div>
            {FOOTER.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className={s.footerTitle}>{col.title}</p>
                <ul className={s.footerList}>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className={s.footerBottom}>
            <span>
              © {new Date().getFullYear()} {SITE.name}. All rights reserved.
            </span>
            <span>Made for the people who build the region.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
