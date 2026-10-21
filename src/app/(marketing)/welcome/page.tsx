"use client";

import { useRef } from "react";
import { m, useScroll, useSpring } from "motion/react";
import {
  ArrowRight,
  Check,
  FileSpreadsheet,
  HardHat,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  CAPABILITIES,
  DEEP_DIVES,
  FACTS,
  FAQS,
  PORTALS,
  SITE,
  STEPS,
  appHref,
} from "./content";
import { BookDemoButton } from "@/components/BookDemoButton";
import { SiteHeader, SiteFooter } from "./site-chrome";
import {
  AnimatedWords,
  CountUpInView,
  EASE_PREMIUM,
  HeroVisual,
  MagneticButton,
  Reveal,
  RevealGroup,
  RevealItem,
} from "./motion";
import { BlogCard } from "@/app/(marketing)/blog/blog-card";
import { POSTS } from "@/app/(marketing)/blog/posts";
import { ACCENTS, Band, BrowserFrame, Bento, NextStep, SectionHead, ShowcaseRoot, Tile, tileParts as T } from "./showcase/showcase";
import { shot } from "./showcase/showcase-page";
import s from "./welcome.module.css";
import h from "./home.module.css";


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
            <StepShot index={i} />
          </Reveal>
        ))}
      </ol>
    </div>
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

const CMP_ROWS = [
  ["Hours to invoice", "Retyped into a billing sheet", "Usually out of scope", "Invoices from the same approved hours"],
  ["WPS salary file", "Built by hand each month", "Varies by product", "Exported from the approved payroll run"],
  ["Visa and ID expiries", "A calendar someone has to check", "Often a basic expiry field", "Alerts, with fields read from the scan"],
  ["Camps and transport", "A separate sheet or phone calls", "Not covered", "Bed-level occupancy and pickup routes"],
  ["Subcontractor crews", "Forwarded spreadsheets", "Not covered", "A supplier portal for demands, hours and payments"],
  ["Who changed what", "Hard to trace", "Varies by product", "Every change in the audit log"],
] as const;

const LATEST = [...POSTS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
const link = { fontWeight: 600, color: "var(--primary)" } as const;
const more = { ...link, display: "inline-flex", alignItems: "center", gap: 6 } as const;

/** Real screens from the demo company, in place of the hand-built mock-ups. */
const DIVE_SHOTS = {
  documents: shot("sol-renewals.webp", 1440, 900, "The Renewals screen: visas, labour cards, passports and Emirates IDs due in the next 90 days, with an expiry timeline."),
  camps: shot("sol-camps.webp", 1400, 940, "The Camps screen: 60 beds, 24 occupied, and Camp A rooms with each bed and its worker."),
  assistant: shot("sol-assistant.webp", 1400, 940, "The assistant panel listing what needs attention today, each item with an Open button."),
} as const;

const STEP_SHOTS = [
  shot("sol-ts-client.webp", 1400, 800, "A September client timesheet with each worker's daily hours."),
  shot("wps-approval.webp", 694, 390, "The approvals inbox with a payroll run waiting for a decision."),
  shot("wps-run-main.webp", 1400, 1085, "An approved payroll run with the process steps and the bank file button."),
] as const;

function DemoShot({ src, width, height, alt, priority }: { src: string; width: number; height: number; alt: string; priority?: boolean }) {
  return (
    <div className={priority ? h.heroShot : h.diveShot}>
      <BrowserFrame>
        {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
        <img src={src} width={width} height={height} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async" />
      </BrowserFrame>
    </div>
  );
}

function StepShot({ index }: { index: number }) {
  const sh = STEP_SHOTS[index];
  // eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public
  return <img className={h.stepShot} src={sh.src} width={sh.width} height={sh.height} alt={sh.alt} loading="lazy" decoding="async" />;
}

export default function WelcomePage() {
  return (
    <div id="top" className={s.page}>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>

      <SiteHeader logoHref="#top" />

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
                <DemoShot {...shot("sol-erp-dash.webp", 1400, 940, "The ManpowerSync dashboard for a 34-worker supplier: workforce total, deployment at 74%, active clients and what needs attention today.")} priority />
              </HeroVisual>
            </div>
          </div>
        </section>
        <div className={s.heroSpacer} aria-hidden />

        <div id="product">
          <ShowcaseRoot accent={ACCENTS.indigo}>
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
              </Bento>
              <div style={{ marginTop: 28 }}>
                <NextStep title="Plus camps, transport, letters, NOCs, sales and an audit trail for all of it." body="More than 30 modules, one login, and permissions that decide who sees what." href="#portals" label="Explore the portals" />
              </div>
            </Band>
          </ShowcaseRoot>
        </div>
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
                <DemoShot {...DIVE_SHOTS[d.visual]} />
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

        <ShowcaseRoot accent={ACCENTS.indigo}>
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
              <a href="/pricing" style={more}>
                See full pricing and what&rsquo;s included <ArrowRight size={14} aria-hidden />
              </a>
            </p>
          </Band>
        </ShowcaseRoot>
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

        <ShowcaseRoot accent={ACCENTS.indigo}>
          <Band soft>
            <SectionHead eyebrow="From the blog" title="Guides for UAE manpower suppliers." />
            <div className={h.guides}>
              {LATEST.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
            <p style={{ margin: "24px 0 0" }}>
              <a href="/blog" style={more}>
                Read all guides <ArrowRight size={14} aria-hidden />
              </a>
            </p>
          </Band>
        </ShowcaseRoot>
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

      <SiteFooter />
    </div>
  );
}
