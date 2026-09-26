import Link from "next/link";
import { Users, Target, Building2, BellRing } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/motion";

type Card = {
  label: string;
  value: number;
  suffix?: string;
  sub: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "danger";
  chip: string;
};

/** Four icon-led KPI tiles — the headline numbers a manager checks first. */
export function DashboardKpiCards({
  employeeCount,
  onWorkCount,
  benchCount,
  deployedPct,
  activeProjectCount,
  activeClientCount,
  attentionCount,
  expiredCount,
}: {
  employeeCount: number;
  onWorkCount: number;
  benchCount: number;
  deployedPct: number;
  activeProjectCount: number;
  activeClientCount: number;
  attentionCount: number;
  expiredCount: number;
}) {
  const cards: Card[] = [
    {
      label: "Total workforce",
      value: employeeCount,
      sub: `${onWorkCount} deployed · ${benchCount} on bench`,
      href: "/employees",
      icon: Users,
      tone: "default",
      chip: "bg-blue-100 text-blue-600",
    },
    {
      label: "Deployment",
      value: deployedPct,
      suffix: "%",
      sub: `${onWorkCount} of ${employeeCount} workers`,
      href: "/employees?filter=on-work",
      icon: Target,
      tone: "default",
      chip: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Active projects",
      value: activeProjectCount,
      sub: `${activeClientCount} active clients`,
      href: "/projects",
      icon: Building2,
      tone: "default",
      chip: "bg-violet-100 text-violet-600",
    },
    {
      label: "Attention",
      value: attentionCount,
      sub: expiredCount > 0 ? `${expiredCount} already expired` : "expiring within 30 days",
      href: "#needs-attention",
      icon: BellRing,
      tone: attentionCount > 0 ? "danger" : "default",
      chip: "bg-[var(--error-soft)] text-[var(--error)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className={cn(
            "card flex flex-col gap-3 p-4 transition hover:-translate-y-px hover:shadow-sm",
            c.tone === "danger" && "border-[var(--error-soft)] bg-[var(--error-soft)]/40"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">{c.label}</span>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", c.chip)}>
              <c.icon className="h-4 w-4" aria-hidden />
            </span>
          </div>
          <div className={cn("tabular text-3xl font-semibold tracking-tight", c.tone === "danger" ? "text-[var(--error)]" : "text-primary")}>
            <AnimatedNumber value={c.value} suffix={c.suffix} />
          </div>
          <p className="text-xs text-subtle">{c.sub}</p>
        </Link>
      ))}
    </div>
  );
}
