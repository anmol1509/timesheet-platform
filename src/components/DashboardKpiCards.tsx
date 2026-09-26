import Link from "next/link";
import { ArrowUpRight, BellRing, Building2, ChevronRight, Target, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/motion";

/** Tiny area-line of a short series, scaled to its own min/max. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-28 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill="var(--brand-primary)" stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

/** Donut showing one share, with the percentage in the middle. */
function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const len = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--success)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${len} ${c}`} />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-primary">{pct}%</span>
    </div>
  );
}

function CardHead({ icon: Icon, label, chip }: { icon: React.ComponentType<{ className?: string }>; label: string; chip: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chip)}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="flex-1 text-sm font-semibold text-primary">{label}</span>
      <ChevronRight className="h-4 w-4 text-subtle opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
    </div>
  );
}

const cardClass = "group card flex flex-col gap-3 p-5 transition hover:-translate-y-px hover:border-strong hover:shadow-md";

/** Headline numbers a manager checks first — each card opens the list behind it. */
export function DashboardKpiCards({
  employeeCount,
  onWorkCount,
  benchCount,
  deployedPct,
  activeProjectCount,
  activeClientCount,
  attentionCount,
  expiredCount,
  headcountTrend,
  newThisMonth,
}: {
  employeeCount: number;
  onWorkCount: number;
  benchCount: number;
  deployedPct: number;
  activeProjectCount: number;
  activeClientCount: number;
  attentionCount: number;
  expiredCount: number;
  headcountTrend: number[];
  newThisMonth: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/employees" className={cardClass}>
        <CardHead icon={Users} label="Total workforce" chip="bg-blue-100 text-blue-600" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="tabular text-[32px] leading-9 font-semibold tracking-[-0.02em] text-primary">
              <AnimatedNumber value={employeeCount} />
            </p>
            {newThisMonth > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--success)]">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                {newThisMonth} this month
              </p>
            ) : (
              <p className="mt-1 text-xs text-subtle">No new joiners this month</p>
            )}
          </div>
          <Sparkline values={headcountTrend} />
        </div>
        <p className="text-xs text-subtle">
          {onWorkCount} deployed · {benchCount} on bench
        </p>
      </Link>

      <Link href="/employees?filter=on-work" className={cardClass}>
        <CardHead icon={Target} label="Deployment" chip="bg-emerald-100 text-emerald-600" />
        <div className="flex items-center gap-4">
          <Ring pct={deployedPct} />
          <div className="min-w-0 flex-1 space-y-1.5 text-xs">
            <p className="tabular text-sm font-semibold text-primary">
              {onWorkCount} / {employeeCount} workers
            </p>
            <p className="flex items-center justify-between gap-2 text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" />Deployed</span>
              <span className="tabular font-semibold text-secondary">{onWorkCount}</span>
            </p>
            <p className="flex items-center justify-between gap-2 text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--border-strong)]" />On bench</span>
              <span className="tabular font-semibold text-secondary">{benchCount}</span>
            </p>
          </div>
        </div>
      </Link>

      <Link href="/projects" className={cardClass}>
        <CardHead icon={Building2} label="Active projects" chip="bg-violet-100 text-violet-600" />
        <p className="tabular text-[32px] leading-9 font-semibold tracking-[-0.02em] text-primary">
          <AnimatedNumber value={activeProjectCount} />
        </p>
        <p className="text-xs text-subtle">{activeClientCount} active client{activeClientCount === 1 ? "" : "s"}</p>
      </Link>

      <Link
        href="/employees/renewals"
        className={cn(
          cardClass,
          attentionCount > 0 && "border-[var(--error-border)] bg-[linear-gradient(160deg,var(--error-soft),var(--surface)_75%)]"
        )}
      >
        <CardHead
          icon={BellRing}
          label="Attention"
          chip={attentionCount > 0 ? "bg-[var(--error)] text-white shadow-sm" : "bg-surface-sunken text-muted"}
        />
        <p className={cn("tabular text-[32px] leading-9 font-semibold tracking-[-0.02em]", attentionCount > 0 ? "text-[var(--error)]" : "text-primary")}>
          <AnimatedNumber value={attentionCount} />
        </p>
        <p className="text-xs font-medium text-secondary">
          {expiredCount > 0 ? `${expiredCount} already expired` : attentionCount > 0 ? "expiring within 30 days" : "Nothing needs attention"}
        </p>
      </Link>
    </div>
  );
}
