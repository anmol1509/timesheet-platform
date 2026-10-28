import { ArrowRight, Check, Download, X } from "lucide-react";
import { BookDemoButton } from "@/components/BookDemoButton";
import { Breadcrumbs } from "../breadcrumbs";
import w from "../welcome.module.css";
import x from "./showcase.module.css";

/**
 * Product-led building blocks for flagship pages. They are server components
 * (only the demo button and breadcrumbs are client islands), render real text
 * and images in the HTML, and avoid scripts-driven entrances so the hero paints
 * immediately.
 */
export type Accent = { accent: string; bright: string; soft: string; ink: string };

export const ACCENTS = {
  mint: { accent: "#10b981", bright: "#34d399", soft: "#e7f8ef", ink: "#065f46" },
  indigo: { accent: "#6366f1", bright: "#818cf8", soft: "#eceefe", ink: "#3730a3" },
  blue: { accent: "#3b82f6", bright: "#60a5fa", soft: "#e8f0fe", ink: "#1e40af" },
  amber: { accent: "#f59e0b", bright: "#fbbf24", soft: "#fdf3dc", ink: "#92400e" },
  rose: { accent: "#f43f5e", bright: "#fb7185", soft: "#fee9ee", ink: "#9f1239" },
  orange: { accent: "#f97316", bright: "#fb923c", soft: "#fff0e3", ink: "#9a3412" },
  violet: { accent: "#8b5cf6", bright: "#a78bfa", soft: "#f0eafe", ink: "#5b21b6" },
  cyan: { accent: "#06b6d4", bright: "#22d3ee", soft: "#e0f7fb", ink: "#155e75" },
  fuchsia: { accent: "#d946ef", bright: "#e879f9", soft: "#fbe9fd", ink: "#86198f" },
} satisfies Record<string, Accent>;

export function ShowcaseRoot({ accent = ACCENTS.mint, children }: { accent?: Accent; children: React.ReactNode }) {
  const vars = { "--x-accent": accent.accent, "--x-bright": accent.bright, "--x-soft": accent.soft, "--x-ink": accent.ink } as React.CSSProperties;
  return (
    <div className={x.root} style={vars}>
      {children}
    </div>
  );
}

export function BrowserFrame({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`${x.frame} ${light ? x.frameLight : ""}`}>
      <div className={x.frameBar} aria-hidden>
        <i />
        <i />
        <i />
      </div>
      {children}
    </div>
  );
}

export function ShowcaseHero({
  pill,
  pillIcon,
  title,
  lead,
  ticks,
  secondaryCta,
  image,
  badge,
  slice,
}: {
  pill: string;
  pillIcon: React.ReactNode;
  title: React.ReactNode;
  lead: string;
  ticks: string[];
  secondaryCta: { href: string; label: string };
  image: { src: string; width: number; height: number; alt: string };
  badge: { icon: React.ReactNode; title: string; sub: string };
  /** An enlarged piece of the real screen, so the numbers stay readable beside the full screenshot. */
  slice: { label: string; amount: string; meta: string; steps: { name: string; state: "done" | "now" | "todo" }[]; button: string; icon?: React.ReactNode };
}) {
  return (
    <section className={x.hero}>
      <div className={x.heroBg} aria-hidden />
      <div className={x.wrap}>
        <div className={x.heroGrid}>
          <div>
            <div className={x.crumbs}>
              <Breadcrumbs />
            </div>
            <span className={x.pill}>
              <span className={x.pillIcon}>{pillIcon}</span>
              {pill}
            </span>
            <h1 className={x.h1}>{title}</h1>
            <p className={x.lead}>{lead}</p>
            <div className={x.ctas}>
              <BookDemoButton className={`${w.btn} ${w.btnOnDark} ${w.btnLg}`}>
                Book a demo <ArrowRight size={16} aria-hidden />
              </BookDemoButton>
              <a href={secondaryCta.href} className={`${w.btn} ${w.btnGhostOnDark} ${w.btnLg}`}>
                {secondaryCta.label}
              </a>
            </div>
            <ul className={x.ticks}>
              {ticks.map((t) => (
                <li key={t}>
                  <Check size={18} strokeWidth={2.6} className={x.tick} aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className={x.heroVisual}>
            <div className={x.tilt}>
              <BrowserFrame>
                {/* The LCP element: real <img> with dimensions and high priority, no opacity animation. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
                <img src={image.src} width={image.width} height={image.height} alt={image.alt} fetchPriority="high" decoding="async" />
              </BrowserFrame>
            </div>
            <div className={`${x.chip} ${x.chipB}`}>
              <span className={x.chipIcon}>{badge.icon}</span>
              <span>
                {badge.title}
                <small>{badge.sub}</small>
              </span>
            </div>
            <div className={x.slice}>
              <span className={x.sliceLabel}>{slice.label}</span>
              <strong className={x.sliceAmount}>{slice.amount}</strong>
              <span className={x.sliceMeta}>{slice.meta}</span>
              <ol className={x.sliceSteps}>
                {slice.steps.map((st) => (
                  <li key={st.name} className={st.state === "done" ? x.done : st.state === "now" ? x.now : ""}>
                    {st.name}
                  </li>
                ))}
              </ol>
              <span className={x.sliceBtn}>
                {slice.icon ?? <Download size={16} aria-hidden />} {slice.button}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Compact hero for a tool page: no screenshot, the tool itself sits right below it. */
export function ToolHero({ pill, pillIcon, title, lead, badges, plain }: { pill: string; pillIcon: React.ReactNode; title: React.ReactNode; lead: string; badges: string[]; /** Show the badges as plain text, without tick icons (for dates and meta). */ plain?: boolean }) {
  return (
    <section className={`${x.hero} ${x.toolHero}`}>
      <div className={x.heroBg} aria-hidden />
      <div className={x.wrap}>
        <div className={x.toolHeroInner}>
          <div className={x.crumbs}>
            <Breadcrumbs />
          </div>
          <span className={x.pill}>
            <span className={x.pillIcon}>{pillIcon}</span>
            {pill}
          </span>
          <h1 className={x.h1}>{title}</h1>
          <p className={x.lead}>{lead}</p>
          <ul className={x.toolBadges}>
            {badges.map((b) => (
              <li key={b}>
                {!plain && <Check size={17} strokeWidth={2.6} className={x.tick} aria-hidden />}
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The tool, lifted so it overlaps the hero's bottom edge. */
export function ToolStage({ children }: { children: React.ReactNode }) {
  return (
    <section className={x.toolStage}>
      <div className={x.wrap}>{children}</div>
    </section>
  );
}

export function HowStrip({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className={x.how}>
      {steps.map((s, i) => (
        <li key={s.title} className={x.howItem}>
          <span className={x.howNum}>{i + 1}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Mid-page conversion block: what to do once the tool has answered the question. */
export function NextStep({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className={x.next}>
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <a href={href} className={`${w.btn} ${w.btnPrimary} ${w.btnLg} ${x.nextBtn}`}>
        {label} <ArrowRight size={16} aria-hidden />
      </a>
    </div>
  );
}

export function ProofStrip({ items }: { items: { value: string; label: string }[] }) {
  return (
    <section className={x.proofSection}>
      <div className={x.wrap}>
        <div className={x.proof}>
          {items.map((i) => (
            <div key={i.label} className={x.proofItem}>
              <span className={x.proofNum}>{i.value}</span>
              <span className={x.proofLabel}>{i.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: React.ReactNode; lead?: string }) {
  return (
    <div className={x.head}>
      <span className={x.eyebrow}>{eyebrow}</span>
      <h2 className={x.h2}>{title}</h2>
      {lead && <p className={x.sub}>{lead}</p>}
    </div>
  );
}

export function Band({ soft, children }: { soft?: boolean; children: React.ReactNode }) {
  return (
    <section className={`${x.section} ${soft ? x.sectionSoft : ""}`}>
      <div className={x.wrap}>{children}</div>
    </section>
  );
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <div className={x.steps}>{children}</div>;
}

export function Step({ n, title, body, children }: { n: number; title: string; body: string; children?: React.ReactNode }) {
  return (
    <article className={x.step}>
      <div className={x.stepBody}>
        <div className={x.stepNum}>{n}</div>
        <h3 className={x.h3}>{title}</h3>
        <p className={x.p}>{body}</p>
      </div>
      <div className={x.stepMedia}>{children}</div>
    </article>
  );
}

export function Peek({ src, width, height, alt, top }: { src: string; width: number; height: number; alt: string; top?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public
    <img className={`${x.peek} ${top ? x.peekTop : ""}`} src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
  );
}

/** The first lines of a real WPS file, as selectable text. */
export function CodeCard({ lines, inStep, label }: { lines: { kind: "EDR" | "SCR" | "gap"; text: string }[]; inStep?: boolean; label: string }) {
  return (
    <pre className={`${x.code} ${inStep ? x.codeInStep : ""}`} role="img" aria-label={label}>
      {lines.map((l, i) =>
        l.kind === "gap" ? (
          <i key={i}>{l.text + "\n"}</i>
        ) : (
          <span key={i}>
            <b>{l.kind}</b>
            {l.text + "\n"}
          </span>
        ),
      )}
    </pre>
  );
}

export function Bento({ children }: { children: React.ReactNode }) {
  return <div className={x.bento}>{children}</div>;
}

export function Tile({
  icon,
  title,
  body,
  tone,
  span2,
  row2,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone?: "dark" | "tint" | "violet" | "sky";
  span2?: boolean;
  row2?: boolean;
  children?: React.ReactNode;
}) {
  const toneClass = tone === "dark" ? x.tileDark : tone === "tint" ? x.tileTint : tone === "violet" ? x.tileViolet : tone === "sky" ? x.tileSky : "";
  return (
    <article className={`${x.tile} ${toneClass} ${span2 ? x.span2 : ""} ${row2 ? x.row2 : ""}`}>
      <span className={x.tileIcon}>{icon}</span>
      <h3 className={x.h3}>{title}</h3>
      <p className={x.p}>{body}</p>
      {children}
    </article>
  );
}

export const tileParts = {
  Media: ({ children }: { children: React.ReactNode }) => <div className={x.tileMedia}>{children}</div>,
  Chips: ({ items }: { items: string[] }) => (
    <div className={x.chips}>
      {items.map((i) => (
        <span key={i} className={x.chipTag}>
          {i}
        </span>
      ))}
    </div>
  ),
  List: ({ items }: { items: string[] }) => (
    <ul className={x.list}>
      {items.map((i) => (
        <li key={i}>
          <Check size={17} strokeWidth={2.6} aria-hidden />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  ),
  Img: ({ src, width, height, alt, fade }: { src: string; width: number; height: number; alt: string; fade?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public
    <img className={`${x.tileImg} ${fade ? x.tileImgFade : ""}`} src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
  ),
  Verdict: ({ title, body, href }: { title: string; body: string; href: string }) => (
    <a className={x.verdict} href={href}>
      <Check size={18} strokeWidth={2.8} aria-hidden />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </a>
  ),
  Zoom: ({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) => (
    <div className={x.zoomBox}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
      <img src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
    </div>
  ),
  Log: ({ items }: { items: { what: string; who: string }[] }) => (
    <ul className={x.log}>
      {items.map((i) => (
        <li key={i.what}>
          {i.what}
          <small>{i.who}</small>
        </li>
      ))}
    </ul>
  ),
};

export function Annotated({
  image,
  pins,
  legend,
}: {
  image: { src: string; width: number; height: number; alt: string };
  pins: { n: number; left: number; top: number }[];
  legend: { title: string; body: string }[];
}) {
  return (
    <div className={x.annot}>
      <ol className={x.legend}>
        {legend.map((l, i) => (
          <li key={l.title}>
            <span className={x.legendNum}>{i + 1}</span>
            <div>
              <h3>{l.title}</h3>
              <p>{l.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={x.shotWrap}>
        <BrowserFrame light>
          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised WebP from /public */}
          <img src={image.src} width={image.width} height={image.height} alt={image.alt} loading="lazy" decoding="async" />
        </BrowserFrame>
        {pins.map((p) => (
          <span key={p.n} className={x.pin} style={{ left: `${p.left}%`, top: `${p.top}%` }} aria-hidden>
            {p.n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BeforeAfter({
  before,
  after,
}: {
  before: { tag: string; title: string; items: string[] };
  after: { tag: string; title: string; items: string[] };
}) {
  return (
    <div className={x.ba}>
      <div className={x.baCard}>
        <span className={x.baTag}>{before.tag}</span>
        <h3>{before.title}</h3>
        <ul className={`${x.baList} ${x.baBad}`}>
          {before.items.map((i) => (
            <li key={i}>
              <X size={18} strokeWidth={2.6} className={x.bad} aria-hidden />
              {i}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${x.baCard} ${x.baGood}`}>
        <span className={x.baTag}>{after.tag}</span>
        <h3>{after.title}</h3>
        <ul className={x.baList}>
          {after.items.map((i) => (
            <li key={i}>
              <Check size={18} strokeWidth={2.8} className={x.good} aria-hidden />
              {i}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function LinkCards({ cards }: { cards: { href: string; title: string; body: string }[] }) {
  return (
    <div className={x.cards}>
      {cards.map((c) => (
        <a key={c.href} href={c.href} className={x.card}>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
          <span className={x.cardMore}>
            Read more <ArrowRight size={15} aria-hidden />
          </span>
        </a>
      ))}
    </div>
  );
}

/** Native <details>: every answer is in the HTML, and it works without JavaScript. */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className={x.faq}>
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function ShowcaseCta({ title, lead, label = "Book a demo" }: { title: string; lead: string; label?: string }) {
  return (
    <section className={x.ctaBand}>
      <div className={x.wrap}>
        <div className={x.cta}>
          <h2>{title}</h2>
          <p>{lead}</p>
          <BookDemoButton className={`${w.btn} ${w.btnOnDark} ${w.btnLg}`}>
            {label} <ArrowRight size={16} aria-hidden />
          </BookDemoButton>
        </div>
      </div>
    </section>
  );
}
