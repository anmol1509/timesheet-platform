import Link from "next/link";
import { Users, ShieldCheck, BedDouble, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/motion";

type Card = {
  label: string;
  value: number;
  pct: number;
  sub: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  chip: string;
  pctColor: string;
};

/** Four icon-led KPI tiles for the Employees list — headcount, deployment split, compliance. */
export function EmployeeKpiCards({
  total,
  onWork,
  bench,
  complianceIssues,
}: {
  total: number;
  onWork: number;
  bench: number;
  complianceIssues: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const cards: Card[] = [
    {
      label: "Total Employees",
      value: total,
      pct: 100,
      sub: "All registered employees",
      href: "/employees",
      icon: Users,
      chip: "bg-blue-100 text-blue-600",
      pctColor: "bg-surface-sunken text-secondary",
    },
    {
      label: "On Work",
      value: onWork,
      pct: pct(onWork),
      sub: "Deployed to projects",
      href: "/employees?filter=on-work",
      icon: ShieldCheck,
      chip: "bg-emerald-100 text-emerald-600",
      pctColor: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Bench",
      value: bench,
      pct: pct(bench),
      sub: "Available for deployment",
      href: "/employees?filter=bench",
      icon: BedDouble,
      chip: "bg-blue-100 text-blue-600",
      pctColor: "bg-amber-100 text-amber-700",
    },
    {
      label: "Compliance Issues",
      value: complianceIssues,
      pct: pct(complianceIssues),
      sub: "Documents / compliance require action",
      href: "/employees/renewals",
      icon: AlertTriangle,
      chip: "bg-[var(--error-soft)] text-[var(--error)]",
      pctColor: "bg-[var(--error-soft)] text-[var(--error)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="card flex flex-col gap-3 p-4 transition hover:-translate-y-px hover:shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", c.chip)}>
              <c.icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-sm font-medium text-secondary">{c.label}</span>
            <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", c.pctColor)}>{c.pct}%</span>
          </div>
          <div className="tabular text-3xl font-semibold tracking-tight text-primary">
            <AnimatedNumber value={c.value} />
          </div>
          <p className="text-xs text-subtle">{c.sub}</p>
        </Link>
      ))}
    </div>
  );
}
