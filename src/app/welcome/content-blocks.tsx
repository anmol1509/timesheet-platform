"use client";

import {
  ArrowRight,
  BedDouble,
  Bot,
  Building2,
  Bus,
  Check,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  FileText,
  Gauge,
  HardHat,
  IdCard,
  Landmark,
  LayoutDashboard,
  Lock,
  Mail,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { BookDemoButton } from "@/components/BookDemoButton";
import type { Tint } from "./content";
import { CountUpInView, MagneticButton, Reveal, RevealGroup, RevealItem } from "./motion";
import s from "./welcome.module.css";

/** Icons are referenced by name, not by component: these blocks are client
 * components rendered from server pages, and a function reference can't
 * cross that boundary. */
export const ICONS = {
  arrow: ArrowRight,
  bed: BedDouble,
  bot: Bot,
  building: Building2,
  bus: Bus,
  check: ClipboardCheck,
  clock: Clock,
  dashboard: LayoutDashboard,
  document: FileText,
  gauge: Gauge,
  hardhat: HardHat,
  id: IdCard,
  leak: TrendingDown,
  lock: Lock,
  mail: Mail,
  phone: Smartphone,
  receipt: Receipt,
  send: Send,
  sheet: FileSpreadsheet,
  shield: ShieldCheck,
  sparkles: Sparkles,
  truck: Truck,
  users: Users,
  wallet: Wallet,
  wps: Landmark,
} as const;

export type IconName = keyof typeof ICONS;

/** Scattered colour dots + wire meshes — the homepage's signature backdrop,
 * shared so every page gets the same treatment rather than a flat panel. */
export function Decorations() {
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

/** Dark navy hero, same family as the homepage's — every content page opens
 * on one so the site reads as one design rather than a landing page plus a
 * pile of documents. */
export function PageHero({
  eyebrow,
  title,
  lead,
  note,
  cta = true,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  note?: string;
  cta?: boolean;
}) {
  return (
    <section className={s.hero}>
      <Decorations />
      <div className={s.container}>
        <div className={s.heroInner} style={{ paddingBottom: 96 }}>
          {eyebrow && (
            <Reveal as="span" className={s.pill} y={10}>
              {eyebrow}
            </Reveal>
          )}
          <Reveal as="h1" className={s.heroTitle} style={{ fontSize: "clamp(38px, 6vw, 62px)", letterSpacing: "-1.5px" }} y={16}>
            {title}
          </Reveal>
          {lead && (
            <Reveal as="p" className={s.heroSub} y={16} delay={0.1}>
              {lead}
            </Reveal>
          )}
          {cta && (
            <Reveal as="div" className={s.heroCtas} y={16} delay={0.18}>
              <MagneticButton>
                <BookDemoButton className={`${s.btn} ${s.btnOnDark} ${s.btnLg}`}>
                  Book a demo <ArrowRight size={16} aria-hidden />
                </BookDemoButton>
              </MagneticButton>
            </Reveal>
          )}
          {note && (
            <Reveal as="p" className={s.heroNote} y={10} delay={0.26}>
              {note}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}

export function Section({
  id,
  surface,
  eyebrow,
  title,
  lead,
  children,
  flush,
}: {
  id?: string;
  surface?: boolean;
  eyebrow?: string;
  title?: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  /** Drops the top padding, for a section that follows another closely. */
  flush?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${s.section} ${surface ? s.sectionSurface : ""}`}
      style={flush ? { paddingTop: 0 } : undefined}
    >
      <div className={s.container}>
        {(eyebrow || title || lead) && (
          <Reveal as="div" className={s.sectionHead} y={16} amount={0.3}>
            {eyebrow && <span className={s.eyebrow}>{eyebrow}</span>}
            {title && <h2 className={s.h2} style={{ fontSize: "clamp(30px, 4vw, 44px)" }}>{title}</h2>}
            {lead && <p className={s.lead}>{lead}</p>}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}

/** Three-up bordered cards with a tinted icon tile — the homepage's
 * "challenges" treatment, reused for any three-point argument. */
export function PointGrid({
  points,
}: {
  points: readonly { icon: IconName; title: string; body: string; tint?: Tint }[];
}) {
  const iconTints: Record<string, [string, string]> = {
    peach: ["var(--tint-peach)", "var(--orange)"],
    rose: ["var(--tint-rose)", "var(--pink)"],
    mint: ["var(--tint-mint)", "var(--teal)"],
    lavender: ["var(--tint-lavender)", "var(--purple)"],
    sky: ["var(--tint-sky)", "var(--link)"],
    yellow: ["var(--tint-yellow-bold)", "var(--orange)"],
    cream: ["var(--tint-cream)", "var(--charcoal)"],
    gray: ["var(--tint-gray)", "var(--charcoal)"],
  };
  const order: Tint[] = ["sky", "mint", "lavender", "peach", "rose", "yellow"];
  return (
    <RevealGroup className={s.challengeGrid} stagger={0.08}>
      {points.map((p, i) => {
        const tint = p.tint ?? order[i % order.length];
        const [bg, fg] = iconTints[tint] ?? iconTints.sky;
        const Icon = ICONS[p.icon];
        return (
          <RevealItem key={p.title} as="article" className={s.challenge}>
            <span className={s.challengeIcon} style={{ background: bg, color: fg }}>
              <Icon size={20} aria-hidden />
            </span>
            <h3 className={s.h5}>{p.title}</h3>
            <p style={{ margin: 0, color: "var(--slate)" }}>{p.body}</p>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}

/** Big tinted feature cards with a check list — the homepage's capability
 * grid, for module/feature rundowns. */
export function TintCardGrid({
  cards,
  columns = 2,
}: {
  cards: readonly { tint: Tint; icon?: IconName; title: string; body: string; points?: readonly string[]; href?: string; cta?: string }[];
  columns?: 2 | 3;
}) {
  return (
    <div className={s.capGridWrap}>
      <RevealGroup
        className={columns === 3 ? s.portalGrid : s.capGrid}
        stagger={0.1}
      >
        {cards.map((c) => {
          const Icon = c.icon ? ICONS[c.icon] : null;
          return (
            <RevealItem key={c.title} as="article" className={`${s.card} ${s[`tint-${c.tint}`]}`}>
              {Icon && (
                <span className={s.iconTile}>
                  <Icon size={22} aria-hidden />
                </span>
              )}
              <h3 className={s.h3}>{c.title}</h3>
              <p className={s.cardBody}>{c.body}</p>
              {c.points && c.points.length > 0 && (
                <ul className={s.checkList}>
                  {c.points.map((p) => (
                    <li key={p}>
                      <Check size={16} aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
              )}
              {c.href && (
                <a href={c.href} className={s.portalCta}>
                  {c.cta ?? "Learn more"} <ArrowRight size={14} aria-hidden />
                </a>
              )}
            </RevealItem>
          );
        })}
      </RevealGroup>
    </div>
  );
}

export function ChipRow({ items }: { items: readonly string[] }) {
  return (
    <RevealGroup className={s.chips} stagger={0.05} amount={0.6} style={{ justifyContent: "center" }}>
      {items.map((p) => (
        <RevealItem key={p} as="span" className={s.chip} y={8}>
          {p}
        </RevealItem>
      ))}
    </RevealGroup>
  );
}

/** Alternating text / visual rows — the homepage's "deep dive" rhythm. */
export function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  flip,
  visual,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points?: readonly string[];
  flip?: boolean;
  visual?: React.ReactNode;
}) {
  return (
    <div className={`${s.dive} ${flip ? s.diveFlip : ""}`}>
      <Reveal as="div" className={s.diveText} y={20}>
        <span className={s.eyebrow}>{eyebrow}</span>
        <h2 className={s.h2sm} style={{ fontSize: "clamp(26px, 3.4vw, 34px)" }}>{title}</h2>
        <p className={s.lead}>{body}</p>
        {points && (
          <RevealGroup className={s.chips} stagger={0.05} amount={0.6}>
            {points.map((p) => (
              <RevealItem key={p} as="span" className={s.chip} y={8}>
                {p}
              </RevealItem>
            ))}
          </RevealGroup>
        )}
      </Reveal>
      {visual}
    </div>
  );
}

export function StatsRow({ facts }: { facts: readonly { value: string; label: string }[] }) {
  return (
    <RevealGroup as="dl" className={s.facts} style={{ margin: 0 }} stagger={0.1} amount={0.6}>
      {facts.map((f) => {
        const match = f.value.match(/^(\d+)(.*)$/);
        const [, digits, suffix] = match ?? [null, f.value, ""];
        return (
          <RevealItem key={f.label} as="div" className={s.fact}>
            <dt className="sr-only">{f.label}</dt>
            <dd style={{ margin: 0 }}>
              <b>{match ? <CountUpInView value={Number(digits)} suffix={suffix} /> : f.value}</b>
              <span>{f.label}</span>
            </dd>
          </RevealItem>
        );
      })}
    </RevealGroup>
  );
}

export function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <Reveal as="div" className={s.faq} amount={0.1}>
      {items.map((f) => (
        <details key={f.q} className={s.faqItem}>
          <summary>
            {f.q}
            <PlusIcon />
          </summary>
          <div className={s.faqAnswerWrap}>
            <div className={s.faqAnswerInner}>
              <p>{f.a}</p>
            </div>
          </div>
        </details>
      ))}
    </Reveal>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** The dark closing band every page ends on. */
export function CtaBand({ title, lead, signInHref }: { title: string; lead: React.ReactNode; signInHref?: string }) {
  return (
    <section className={s.section}>
      <div className={s.container}>
        <Reveal as="div" className={s.cta} y={28} amount={0.4}>
          <Decorations />
          <h2 className={s.h2} style={{ fontSize: "clamp(28px, 4vw, 44px)" }}>{title}</h2>
          <p className={s.lead} style={{ color: "#c9cbe0" }}>{lead}</p>
          <div className={s.heroCtas}>
            <MagneticButton>
              <BookDemoButton className={`${s.btn} ${s.btnOnDark} ${s.btnLg}`}>
                Book a demo <ArrowRight size={16} aria-hidden />
              </BookDemoButton>
            </MagneticButton>
            {signInHref && (
              <a href={signInHref} className={`${s.btn} ${s.btnGhostOnDark} ${s.btnLg}`}>
                Sign in
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** Link cards for hub/index pages (solutions, industries, guides, blog). */
export function LinkCardGrid({
  cards,
  columns = 2,
}: {
  cards: readonly { href: string; title: string; body: string; meta?: string; tint?: Tint }[];
  columns?: 2 | 3;
}) {
  const order: Tint[] = ["sky", "mint", "peach", "lavender", "rose", "cream", "yellow", "gray"];
  return (
    <RevealGroup className={columns === 3 ? s.portalGrid : s.capGrid} stagger={0.08}>
      {cards.map((c, i) => (
        <RevealItem key={c.href} as="article" className={`${s.card} ${s[`tint-${c.tint ?? order[i % order.length]}`]}`}>
          {c.meta && <span className={s.eyebrow} style={{ marginBottom: 8 }}>{c.meta}</span>}
          <h3 className={s.h3}>
            <a href={c.href}>{c.title}</a>
          </h3>
          <p className={s.cardBody}>{c.body}</p>
          <a href={c.href} className={s.portalCta}>
            Read more <ArrowRight size={14} aria-hidden />
          </a>
        </RevealItem>
      ))}
    </RevealGroup>
  );
}
