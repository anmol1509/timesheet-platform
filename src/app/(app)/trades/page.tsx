import { Wrench, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { mayEditSkill, visibleSkillWhere } from "@/lib/skillScope";
import { createSkillAction } from "./actions";
import { TradeTable } from "./trade-table";
import { Checkbox } from "@/components/ui/Checkbox";
import { BarList } from "@/components/BarList";
import { Panel } from "@/components/DashboardPanel";

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
      <PageHeader
        title="Trades"
        icon={Wrench}
        description={<>The trades your workforce holds, and where demand is highest.</>}
      />

      <form
        action={createSkillAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Trade name *</span>
          <input
            name="name"
            required
            placeholder="e.g. Welding"
            className="input w-full"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Category
          </span>
          <input
            name="category"
            placeholder="e.g. Technical"
            className="input w-full"
          />
        </label>
        <div className="pb-2">
          <Checkbox name="trending" value="on" label="Trending" />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />

          Add Trade
        </button>
      </form>

      {rows.length > 0 && (
        <Panel title="Top trades by headcount" href="/employees">
          <BarList
            tone="brand"
            items={[...rows]
              .sort((a, b) => b.employeeCount - a.employeeCount)
              .slice(0, 8)
              .map((r) => ({ key: r.id, label: r.name, value: r.employeeCount }))}
            emptyLabel="No employees assigned to a trade yet."
          />
        </Panel>
      )}
      <TradeTable trades={rows} />
    </div>
  );
}
