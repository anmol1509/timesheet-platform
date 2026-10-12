import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BedDouble,
  Building2,
  Bus,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Hourglass,
  Lock,
  MapPin,
  PauseCircle,
  Receipt,
  ShieldAlert,
  Tent,
  Truck,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/motion";

export type KpiCell = {
  label: string;
  /** Numbers count up; strings ("AED 1,200", "3/10") render as given. */
  value: number | string;
  suffix?: string;
  sub: string;
  href: string;
  /** 0–100; renders a thin progress meter under the value. */
  meter?: number;
  /** Colours the value and the icon chip. Reserve for real status, not decoration. */
  tone?: "default" | "warning" | "danger" | "success";
  /** Overrides the icon inferred from the label. */
  icon?: LucideIcon;
};

// Callers pass plain labels; a matching icon keeps every module dashboard on
// the same visual language without each page choosing its own.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/terminat/, UserMinus],
  [/deployed|on site|marked today/, UserCheck],
  [/employee|workforce|headcount/, Users],
  [/compliance|expir/, ShieldAlert],
  [/overdue|alert|short-staffed|blacklist/, AlertTriangle],
  [/on hold/, PauseCircle],
  [/project/, FolderKanban],
  [/client/, Building2],
  [/supplier/, Truck],
  [/request|demand|fulfil/, ClipboardList],
  [/awaiting bed|occupancy|bed/, BedDouble],
  [/camp/, Tent],
  [/vehicle|route/, Bus],
  [/site/, MapPin],
  [/lock/, Lock],
  [/pending|awaiting/, Hourglass],
  [/approved|converted|paid/, BadgeCheck],
  [/rows|timesheet/, FileSpreadsheet],
  [/invoice|outstanding|billing/, Receipt],
  [/quotation|enquir/, FileText],
  [/payroll|salary/, Wallet],
  [/amount|revenue|aed|value/, CircleDollarSign],
  [/today|month/, CalendarCheck],
  [/hour/, Clock],
];

function iconFor(label: string): LucideIcon {
  const l = label.toLowerCase();
  return ICON_RULES.find(([re]) => re.test(l))?.[1] ?? BarChart3;
}

const TONE_CHIP: Record<NonNullable<KpiCell["tone"]>, string> = {
  default: "bg-brand-soft text-[var(--brand-primary)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--error-soft)] text-[var(--error)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
};

const TONE_TEXT: Record<NonNullable<KpiCell["tone"]>, string> = {
  default: "text-primary",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--error)]",
  success: "text-primary",
};

/**
 * Row of KPI cards. Each is its own card — icon chip, label, a large value,
 * one line of context — and links to the list it summarises.
 */
export function KpiStrip({ cells }: { cells: KpiCell[] }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", cells.length >= 4 ? "lg:grid-cols-4" : cells.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {cells.map((cell) => {
        const tone = cell.tone ?? "default";
        const Icon = cell.icon ?? iconFor(cell.label);
        return (
          <Link
            key={cell.label}
            href={cell.href}
            className={cn(
              "group card relative flex flex-col p-4 transition hover:-translate-y-px hover:border-strong hover:shadow-md",
              tone === "danger" && "border-[var(--error-border)] bg-[linear-gradient(180deg,var(--error-soft),var(--surface)_70%)]",
              tone === "warning" && "border-[var(--warning-border)] bg-[linear-gradient(180deg,var(--warning-soft),var(--surface)_70%)]"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]", TONE_CHIP[tone])}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted">{cell.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
            </div>
            <div
              className={cn(
                "tabular mt-3 font-semibold tracking-[-0.02em]",
                typeof cell.value === "string" && cell.value.length > 6 ? "text-[22px] leading-8" : "text-[30px] leading-9",
                TONE_TEXT[tone]
              )}
            >
              {typeof cell.value === "number" ? <AnimatedNumber value={cell.value} suffix={cell.suffix} /> : cell.value}
            </div>
            {cell.meter !== undefined && (
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)]"
                  style={{ width: `${Math.min(100, Math.max(0, cell.meter))}%` }}
                />
              </div>
            )}
            <div className={cn("text-xs text-subtle", cell.meter !== undefined ? "mt-2" : "mt-1.5")}>{cell.sub}</div>
          </Link>
        );
      })}
    </div>
  );
}
