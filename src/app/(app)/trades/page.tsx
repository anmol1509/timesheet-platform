import { prisma } from "@/lib/db";
import { createSkillAction } from "./actions";
import { TradeTable } from "./trade-table";
import { Checkbox } from "@/components/ui/Checkbox";

export default async function SkillsPage() {
  const [skills, totalEmployees] = await Promise.all([
    prisma.skill.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.employee.count(),
  ]);

  const rows = skills.map((s) => {
    const employeeCount = s._count.employees;
    const popularity = totalEmployees > 0 ? (employeeCount / totalEmployees) * 100 : 0;
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      trending: s.trending,
      employeeCount,
      popularity,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Trades</h1>
        <p className="mt-1 text-sm text-muted">
          The trades your workforce holds, and where demand is highest.
        </p>
      </div>

      <form
        action={createSkillAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Trade name
          </span>
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
          + Add Trade
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="empty-state text-sm text-muted">
          No skills tracked yet. Add one above, or tag skills from an
          employee&rsquo;s profile.
        </p>
      ) : (
        <TradeTable trades={rows} />
      )}
    </div>
  );
}
