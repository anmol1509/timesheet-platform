"use client";

import { useRef, useState } from "react";
import { m, useScroll, useSpring } from "motion/react";
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
  NAV,
  PORTALS,
  SITE,
  STEPS,
  appHref,
} from "./content";
import { BRAND_ICON, BRAND_LOGO, BRAND_LOGO_ASPECT } from "@/lib/brand-assets";
import { BookDemoButton } from "@/components/BookDemoButton";
import { MobileMenu } from "./mobile-menu";
import {
  AnimatedWords,
  CountUpInView,
  EASE_PREMIUM,
  HeroVisual,
  MagneticButton,
  Reveal,
  RevealGroup,
  RevealItem,
  useScrolled,
} from "./motion";
import s from "./welcome.module.css";

const statVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_PREMIUM } },
};
const rowVariant = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM } },
};

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
  const height = 44;
  return (
    <a href="#top" className={s.logo} aria-label={`${SITE.name} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
      <img
        src={BRAND_LOGO}
        alt={SITE.name}
        height={height}
        width={Math.round(height * BRAND_LOGO_ASPECT)}
        style={{ height, width: "auto" }}
      />
    </a>
  );
}

// The full BRAND_LOGO wordmark renders "ManpowerSync" in dark navy, so it
// disappears on the footer's dark background — use the colour icon mark plus
// a plain white text wordmark instead of the flattened PNG.
function FooterLogo() {
  const height = 40;
  return (
    <span className={s.footerLogoRow}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no loader needed */}
      <img src={BRAND_ICON} alt="" height={height} width={height} style={{ height, width: "auto" }} />
      <span className={s.footerWordmark}>{SITE.name}</span>
    </span>
  );
}

const CHALLENGE_CONVERGE = [
  ["Excel", "Paper", "Photo"],
  ["Visa", "Emirates ID", "Passport"],
  ["Overtime", "Loans", "Deductions"],
  ["Approved hrs", "Invoice"],
  ["Camp", "Bus route", "Site"],
  ["Email", "Spreadsheet"],
] as const;

/** Small chips fading/sliding toward the card's icon once in view — the
 * "scattered inputs converging on one system" metaphor, reused across every
 * challenge card with its own real labels rather than six bespoke illustrations. */
function ChallengeConverge({ items }: { items: readonly string[] }) {
  return (
    <m.div
      className={s.convergeRow}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } } }}
    >
      {items.map((label, i) => (
        <m.span
          key={label}
          className={s.convergeChip}
          variants={{
            hidden: { opacity: 0, x: i % 2 ? 10 : -10 },
            show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_PREMIUM } },
          }}
        >
          {label}
        </m.span>
      ))}
      <m.span
        className={s.convergeArrow}
        variants={{
          hidden: { opacity: 0, scale: 0.6 },
          show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_PREMIUM } },
        }}
        aria-hidden
      >
        <ArrowRight size={13} />
      </m.span>
    </m.div>
  );
}

/** The "How it works" scroll-linked signature: a track that fills as the
 * user scrolls past the three steps, plus each step's number lighting up
 * once it's reached — makes the hours→approval→payday pipeline read as one
 * continuous, literal flow instead of three unrelated cards. */
function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.75", "end 0.4"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 26, restDelta: 0.001 });

  return (
    <div className={s.howWrap}>
      <div className={s.howTrack} aria-hidden>
        <m.div className={s.howTrackFill} style={{ scaleX: fill }} />
      </div>
      <ol ref={ref} className={s.steps} style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {STEPS.map((step, i) => (
          <Reveal key={step.n} as="li" className={s.step} delay={i * 0.1} amount={0.4}>
            <m.span
              className={s.stepNum}
              initial={{ color: "var(--stone)" }}
              whileInView={{ color: "var(--primary)" }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.3, ease: EASE_PREMIUM, delay: 0.15 }}
            >
              {step.n}
            </m.span>
            <h3 className={s.h3} style={{ marginTop: 8 }}>
              {step.title}
            </h3>
            <p className={s.cardBody} style={{ color: "var(--slate)" }}>
              {step.body}
            </p>
            <StepVisual index={i} />
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

function NavLinks() {
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <ul className={s.navLinks} onPointerLeave={() => setHovered(null)}>
      {NAV.map((n) => (
        <li key={n.href} className={s.navLinkItem}>
          <a href={n.href} onPointerEnter={() => setHovered(n.href)}>
            {n.label}
          </a>
          {hovered === n.href && (
            <m.span
              layoutId="nav-hover-pill"
              className={s.navHoverPill}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function Nav() {
  const scrolled = useScrolled();
  return (
    <m.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_PREMIUM }}
      className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}
    >
      <div className={`${s.container} ${s.navInner}`}>
        <Logo />
        <nav aria-label="Primary" className={s.navPrimary}>
          <NavLinks />
        </nav>
        <div className={s.navActions}>
          <a href={appHref("/login")} className={`${s.btn} ${s.btnGhost}`}>
            Sign in
          </a>
          <MagneticButton>
            <BookDemoButton className={`${s.btn} ${s.btnPrimary}`}>
              Book a demo
            </BookDemoButton>
          </MagneticButton>
        </div>
        <MobileMenu />
      </div>
    </m.header>
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
    { icon: Clock, label: "Timesheets", active: true, flow: 0 },
    { icon: ClipboardCheck, label: "Approvals", flow: 1 },
    { icon: Users, label: "Employees" },
    { icon: Wallet, label: "Payroll", flow: 2 },
    { icon: Receipt, label: "Invoices", flow: 3 },
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
          {side.map(({ icon: Icon, label, active, flow }) => (
            <div key={label} className={`${s.mockSideItem} ${active ? s.mockSideActive : ""}`}>
              <Icon size={15} /> {label}
              {flow !== undefined && (
                <m.span
                  className={s.flowDot}
                  initial={{ opacity: 0.25, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: EASE_PREMIUM, delay: 1.6 + flow * 0.18 }}
                  aria-hidden
                />
              )}
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
          <m.div
            className={s.mockStats}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.8 } } }}
          >
            <m.div className={s.mockStat} variants={statVariant}>
              <b>
                <CountUpInView value={412} />
              </b>
              <span>Workers</span>
            </m.div>
            <m.div className={s.mockStat} variants={statVariant}>
              <b>
                <CountUpInView value={84216} />
              </b>
              <span>Regular hours</span>
            </m.div>
            <m.div className={s.mockStat} variants={statVariant}>
              <b>
                <CountUpInView value={6930} />
              </b>
              <span>Overtime hours</span>
            </m.div>
            <m.div className={s.mockStat} variants={statVariant}>
              <b>
                <CountUpInView value={97} suffix="%" />
              </b>
              <span>Approved</span>
            </m.div>
          </m.div>
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
              <m.tbody
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 1.1 } } }}
              >
                {ROWS.map((r) => (
                  <m.tr key={r.name} variants={rowVariant}>
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
                  </m.tr>
                ))}
              </m.tbody>
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
    <m.div
      className={s.miniMock}
      aria-hidden
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.6 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
    >
      {minis[index].map(([label, value]) => (
        <m.div
          key={label}
          className={s.miniRow}
          variants={{
            hidden: { opacity: 0, y: 6 },
            show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM } },
          }}
        >
          <span>{label}</span>
          {value}
        </m.div>
      ))}
    </m.div>
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

const fieldVariant = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM } },
};

function DocumentsVisual() {
  return (
    <m.div
      className={`${s.diveVisual} ${s["tint-sky"]}`}
      aria-hidden
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      <div className={s.diveCard}>
        <m.div
          className={s.scan}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0, delayChildren: 0 } } }}
        >
          <m.span
            className={s.scanThumb}
            style={{ position: "relative", overflow: "hidden" }}
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
          >
            <m.span
              className={s.scanLine}
              variants={{
                hidden: { y: -6, opacity: 0 },
                show: { y: 60, opacity: [0, 1, 1, 0], transition: { duration: 0.9, ease: "easeInOut", delay: 0.15 } },
              }}
            />
          </m.span>
          <div>
            <b>passport_scan.pdf</b>
            <m.div
              className={s.miniMuted}
              style={{ fontSize: 13 }}
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3, delay: 1.05 } } }}
            >
              <Sparkles size={13} style={{ verticalAlign: "-2px" }} /> 6 fields extracted
            </m.div>
          </div>
        </m.div>
        <m.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 1.2 } } }}>
          {[
            ["Full name", "Rajesh Kumar"],
            ["Passport no.", "Z4821••••"],
            ["Nationality", "India"],
            ["Visa expiry", <span key="v" className={`${s.tag} ${s.tagOrange}`}>in 28 days</span>],
            ["Emirates ID", "784-19••-•••••••-2"],
          ].map(([k, v], i) => (
            <m.div key={String(k)} className={s.field} variants={fieldVariant}>
              <span className={s.fieldLabel}>{k}</span>
              {i === 3 ? (
                <m.span
                  variants={{
                    hidden: { opacity: 0, scale: 0.85 },
                    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_PREMIUM } },
                  }}
                >
                  {v}
                </m.span>
              ) : (
                <span>{v}</span>
              )}
            </m.div>
          ))}
        </m.div>
      </div>
    </m.div>
  );
}

function CampsVisual() {
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
    <m.div
      className={`${s.diveVisual} ${s["tint-mint"]}`}
      aria-hidden
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>Sonapur Camp · Block C</b>
          <span className={`${s.tag} ${s.tagGreen}`}>81% occupied</span>
        </div>
        <div className={s.bar}>
          <m.span
            variants={{ hidden: { width: "0%" }, show: { width: "81%", transition: { duration: 0.9, ease: EASE_PREMIUM, delay: 0.1 } } }}
          />
        </div>
        <m.div
          className={s.rooms}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } } }}
        >
          {rooms.map((beds, i) => (
            <m.div key={i} className={s.room} variants={fieldVariant}>
              C-{101 + i}
              <div className={s.beds}>
                {beds.map((b, j) => (
                  <span key={j} className={`${s.bed} ${b ? s.bedFull : ""}`} />
                ))}
              </div>
            </m.div>
          ))}
        </m.div>
        <m.div
          className={s.stepLine}
          style={{ marginTop: 16 }}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3, delay: 1.0 } } }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Bus size={14} />
            Route 4 · Sonapur
            <svg width="36" height="10" viewBox="0 0 36 10" style={{ overflow: "visible" }}>
              <m.path
                d="M0 5 H30"
                stroke="var(--teal)"
                strokeWidth="1.5"
                variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.6, ease: "easeInOut", delay: 1.1 } } }}
              />
              <m.circle
                cx="30"
                cy="5"
                r="2.5"
                fill="var(--teal)"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2, delay: 1.7 } } }}
              />
            </svg>
            Al Quoz
          </span>
          <span className={s.miniMuted}>05:30 · 48 seats</span>
        </m.div>
      </div>
    </m.div>
  );
}

function AssistantVisual() {
  return (
    <m.div
      className={`${s.diveVisual} ${s["tint-lavender"]}`}
      aria-hidden
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      <div className={`${s.diveCard} ${s.chat}`}>
        <m.div
          className={s.bubbleUser}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM } } }}
        >
          Which visas expire in the next 30 days?
        </m.div>
        <m.div
          className={s.thinking}
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: [0, 1, 1, 0], transition: { duration: 0.6, delay: 0.35, times: [0, 0.2, 0.8, 1] } },
          }}
          aria-hidden
        >
          <span />
          <span />
          <span />
        </m.div>
        <m.div
          className={s.bubbleBot}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM, delay: 0.9 } } }}
        >
          7 employees have visas expiring before 30 June:
          <m.ul variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 1.25 } } }}>
            <m.li variants={fieldVariant}>
              <span className={s.linkish}>Rajesh Kumar</span> · 22 Jun
            </m.li>
            <m.li variants={fieldVariant}>
              <span className={s.linkish}>Joseph Santos</span> · 25 Jun
            </m.li>
            <m.li variants={fieldVariant}>
              <span className={s.linkish}>+5 more</span> in Documents
            </m.li>
          </m.ul>
        </m.div>
        <m.div
          className={s.bubbleUser}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM, delay: 1.75 } } }}
        >
          Draft renewal NOCs for them.
        </m.div>
      </div>
    </m.div>
  );
}

function DiveVisual({ kind }: { kind: "documents" | "camps" | "assistant" }) {
  if (kind === "documents") return <DocumentsVisual />;
  if (kind === "camps") return <CampsVisual />;
  return <AssistantVisual />;
}

export default function WelcomePage() {
  return (
    <div id="top" className={s.page}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>

      <Nav />

      <main id="main">
        <section className={s.hero} aria-labelledby="hero-title">
          <Decorations />
          <div className={s.container}>
            <div className={s.heroInner}>
              <m.span
                className={s.pill}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.1 }}
              >
                <span className={s.pillBadge}>New</span>
                AI document extraction for passports, visas &amp; Emirates IDs
              </m.span>
              <h1 id="hero-title" className={s.heroTitle}>
                <AnimatedWords text="Your workforce, from" startDelay={0.2} />{" "}
                <em>
                  <AnimatedWords text="timesheet" startDelay={0.2 + 3 * 0.045} />
                </em>{" "}
                <AnimatedWords text="to payday." startDelay={0.2 + 4 * 0.045} />
              </h1>
              <m.p
                className={s.heroSub}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.35 }}
              >
                {SITE.name} runs your manpower business in one place: hours, approvals, payroll with WPS, client
                invoices, camps, transport and documents.
              </m.p>
              <m.div
                className={s.heroCtas}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.5 }}
              >
                <MagneticButton>
                  <BookDemoButton className={`${s.btn} ${s.btnPrimary} ${s.btnLg}`}>
                    Book a demo <ArrowRight size={16} aria-hidden />
                  </BookDemoButton>
                </MagneticButton>
                <a href="#how" className={`${s.btn} ${s.btnGhostOnDark} ${s.btnLg}`}>
                  See how it works
                </a>
              </m.div>
              <m.p
                className={s.heroNote}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE_PREMIUM, delay: 0.6 }}
              >
                Bring your existing Excel timesheets, no re-keying
              </m.p>
            </div>
            <div className={s.heroMockWrap}>
              <HeroVisual>
                <HeroMock />
              </HeroVisual>
            </div>
          </div>
        </section>
        <div className={s.heroSpacer} aria-hidden />

        <section id="challenges" className={`${s.section} ${s.sectionSurface}`} aria-labelledby="challenges-title">
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.eyebrow}>Sound familiar?</span>
              <h2 id="challenges-title" className={s.h2}>
                Spreadsheets weren&rsquo;t built to run a workforce.
              </h2>
              <p className={s.lead}>
                Supplying hundreds of workers to client sites is a different business from employing them in one
                office. Most HRMS and ERP tools stop at employee records and payroll, so everything else ends up in
                spreadsheets, WhatsApp groups and inboxes.
              </p>
            </div>
            <RevealGroup className={s.challengeGrid} stagger={0.08}>
              {CHALLENGES.map((ch, i) => {
                const Icon = CHALLENGE_ICONS[ch.icon];
                return (
                  <RevealItem key={ch.title} as="article" className={s.challenge}>
                    <span className={s.challengeIcon}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <h3 className={s.h5}>{ch.title}</h3>
                    <p>{ch.body}</p>
                    <ChallengeConverge items={CHALLENGE_CONVERGE[i]} />
                  </RevealItem>
                );
              })}
            </RevealGroup>
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
            <div className={s.capGridWrap}>
              <RevealGroup className={s.capGrid} stagger={0.1}>
                {CAPABILITIES.map((c, i) => {
                  const Icon = CAP_ICONS[c.icon];
                  return (
                    <RevealItem key={c.title} as="article" className={`${s.card} ${s[`tint-${c.tint}`]}`}>
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
                    </RevealItem>
                  );
                })}
              </RevealGroup>
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
            <HowItWorks />
          </div>
        </section>

        <section className={s.section} aria-label="Features in detail">
          <div className={s.container}>
            {DEEP_DIVES.map((d, i) => (
              <div key={d.title} className={`${s.dive} ${i % 2 ? s.diveFlip : ""}`}>
                <Reveal as="div" className={s.diveText} y={20}>
                  <span className={s.eyebrow}>{d.eyebrow}</span>
                  <h2 className={s.h2sm}>{d.title}</h2>
                  <p className={s.lead}>{d.body}</p>
                  <RevealGroup className={s.chips} stagger={0.05} amount={0.6}>
                    {d.points.map((p) => (
                      <RevealItem key={p} as="span" className={s.chip} y={8}>
                        {p}
                      </RevealItem>
                    ))}
                  </RevealGroup>
                </Reveal>
                <DiveVisual kind={d.visual} />
              </div>
            ))}
          </div>
        </section>

        <section className={s.section} style={{ paddingTop: 0 }} aria-label="At a glance">
          <div className={s.container}>
            <RevealGroup as="dl" className={s.facts} style={{ margin: 0 }} stagger={0.1} amount={0.6}>
              {FACTS.map((f) => {
                const match = f.value.match(/^(\d+)(.*)$/);
                const [, digits, suffix] = match ?? [null, f.value, ""];
                return (
                  <RevealItem key={f.label} as="div" className={s.fact}>
                    <dt className="sr-only">{f.label}</dt>
                    <dd style={{ margin: 0 }}>
                      <b>
                        {match ? <CountUpInView value={Number(digits)} suffix={suffix} /> : f.value}
                      </b>
                      <span>{f.label}</span>
                    </dd>
                  </RevealItem>
                );
              })}
            </RevealGroup>
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
            <RevealGroup as="div" className={s.portalGrid} stagger={0.1}>
              {PORTALS.map((p) => (
                <RevealItem key={p.title} as="article" className={`${s.card} ${s[`tint-${p.tint}`]}`}>
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
                </RevealItem>
              ))}
            </RevealGroup>
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
            <Reveal as="div" className={s.faq} amount={0.1}>
              {FAQS.map((f) => (
                <details key={f.q} className={s.faqItem}>
                  <summary>
                    {f.q}
                    <Plus size={20} aria-hidden />
                  </summary>
                  <div className={s.faqAnswerWrap}>
                    <div className={s.faqAnswerInner}>
                      <p>{f.a}</p>
                    </div>
                  </div>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        <section className={s.section} aria-labelledby="cta-title">
          <div className={s.container}>
            <Reveal as="div" className={s.cta} y={28} amount={0.4}>
              <Decorations />
              <h2 id="cta-title" className={s.h2}>
                Close next month in days, not weeks.
              </h2>
              <p className={s.lead}>
                See {SITE.name} with your own timesheet workbook. A 30-minute call is all it takes.
              </p>
              <div className={s.heroCtas}>
                <MagneticButton>
                  <BookDemoButton className={`${s.btn} ${s.btnOnDark} ${s.btnLg}`}>
                    Book a demo <ArrowRight size={16} aria-hidden />
                  </BookDemoButton>
                </MagneticButton>
                <a href={appHref("/login")} className={`${s.btn} ${s.btnGhostOnDark} ${s.btnLg}`}>
                  Sign in
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.container}>
          <Reveal as="div" className={s.footerGrid} y={16} amount={0.2}>
            <div className={s.footerBrand}>
              <FooterLogo />
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
                      {l.label === "Book a demo" ? (
                        <BookDemoButton className={s.footerDemoLink}>{l.label}</BookDemoButton>
                      ) : (
                        <a href={l.href}>{l.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </Reveal>
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
