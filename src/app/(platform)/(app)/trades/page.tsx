import { Wrench } from "lucide-react";
import { HeroHeader, heroButton } from "@/components/HeroHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { mayEditSkill, visibleSkillWhere } from "@/lib/skillScope";
import { AddTrade } from "./add-trade";
import { TradeTable } from "./trade-table";

export default async function SkillsPage() {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const [skills, totalEmployees] = await Promise.all([
    prisma.skill.findMany({
      // The shared catalogue plus this branch's own trades — never another branch's.
      where: visibleSkillWhere(branchId),
      orderBy: { name: "asc" },
    }),
    prisma.employee.count({ where: branchWhere(branchId) }),
  ]);

  const [idleRows, demandRows, headcountRows] = await Promise.all([
    prisma.employee.groupBy({ by: ["trade"], where: { ...branchWhere(branchId), status: "IDLE", trade: { not: null } }, _count: { _all: true } }),
    prisma.demandRequestTrade.findMany({
      where: { demandRequest: { ...branchWhere(branchId), status: { in: ["Open", "Approved"] } } },
      select: { trade: true, quantity: true, approvedQuantity: true, _count: { select: { allocations: true } } },
    }),
    // The employee's own `trade` field is what every other trade dropdown
    // and filter reads — a Skill's `_count.employees` instead counts
    // EmployeeSkill rows, which only exist once someone manually tags a
    // "Known Trade Detail" on a profile, so it read ~0 for almost everyone
    // despite `trade` being populated. Headcount here now matches Employees.
    prisma.employee.groupBy({ by: ["trade"], where: { ...branchWhere(branchId), trade: { not: null } }, _count: { _all: true } }),
  ]);
  const key = (t: string | null) => (t ?? "").trim().toLowerCase();
  const idleBy = new Map(idleRows.map((r) => [key(r.trade), r._count._all]));
  const headcountBy = new Map(headcountRows.map((r) => [key(r.trade), r._count._all]));
  const openBy = new Map<string, number>();
  for (const d of demandRows) {
    const gap = Math.max(0, (d.approvedQuantity ?? d.quantity) - d._count.allocations);
    openBy.set(key(d.trade), (openBy.get(key(d.trade)) ?? 0) + gap);
  }

  const rows = skills.map((s) => {
    const employeeCount = headcountBy.get(key(s.name)) ?? 0;
    const popularity = totalEmployees > 0 ? (employeeCount / totalEmployees) * 100 : 0;
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      category: s.category,
      trending: s.trending,
      // Shared trades are read-only to a client; only their own can be changed.
      shared: s.branchId === null,
      editable: mayEditSkill(s, { branchId, isSuperAdmin }),
      employeeCount,
      popularity,
      idle: idleBy.get(key(s.name)) ?? 0,
      openDemand: openBy.get(key(s.name)) ?? 0,
    };
  });

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={Wrench}
        title="Trades"
        subtitle="The trades your workforce holds, and where demand is highest."
        pills={[
          { label: "Trades", value: String(rows.length) },
          { label: "Workers with a trade", value: String(rows.reduce((n, r) => n + r.employeeCount, 0)) },
          { label: "Idle now", value: String(rows.reduce((n, r) => n + r.idle, 0)) },
          { label: "Open demand", value: String(rows.reduce((n, r) => n + r.openDemand, 0)), warn: rows.some((r) => r.openDemand > 0) },
        ]}
        actions={<AddTrade triggerClassName={heroButton(true)} />}
      />

      {rows.length > 0 && (() => {
        const shown = [...rows].sort((a, b) => Math.max(0, b.openDemand - b.idle) - Math.max(0, a.openDemand - a.idle) || b.employeeCount - a.employeeCount).slice(0, 8);
        const max = Math.max(1, ...shown.map((r) => Math.max(r.employeeCount, r.employeeCount + r.openDemand)));
        return (
          <section className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-primary">Supply vs demand</h2>
                <p className="text-xs text-muted">Workers you have, against workers clients are still asking for. Trades short of people come first.</p>
              </div>
              <p className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand-primary)]" />Workers</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--warning)]" />Still needed</span>
              </p>
            </div>
            <ul className="mt-4 space-y-2">
              {shown.map((r) => {
                const short = Math.max(0, r.openDemand - r.idle);
                return (
                  <li key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_7rem] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_8rem]">
                    <span className="truncate text-secondary" title={r.name}>{r.name}</span>
                    <span className="flex h-3.5 gap-0.5">
                      <span className="h-full rounded bg-[var(--brand-primary)]" style={{ width: `${(r.employeeCount / max) * 100}%`, minWidth: r.employeeCount ? 4 : 0 }} title={`${r.employeeCount} workers`} />
                      <span className="h-full rounded bg-[var(--warning)]" style={{ width: `${(r.openDemand / max) * 100}%`, minWidth: r.openDemand ? 4 : 0 }} title={`${r.openDemand} still needed`} />
                    </span>
                    <span className={short ? "text-right text-xs font-medium text-[var(--warning)]" : "text-right text-xs text-subtle"}>{short ? `short by ${short}` : r.openDemand ? "bench covers it" : "no open demand"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })()}
      <TradeTable trades={rows} />
    </div>
  );
}
