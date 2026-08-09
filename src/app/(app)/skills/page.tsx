import { prisma } from "@/lib/db";
import { createSkillAction } from "./actions";
import { SkillTable } from "./skill-table";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Skills</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track the skills your workforce has, and where demand is highest.
        </p>
      </div>

      <form
        action={createSkillAction}
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Skill name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Welding"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Category
          </span>
          <input
            name="category"
            placeholder="e.g. Technical"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <div className="pb-2">
          <Checkbox name="trending" value="on" label="Trending" />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + Add Skill
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No skills tracked yet. Add one above, or tag skills from an
          employee&rsquo;s profile.
        </p>
      ) : (
        <SkillTable skills={rows} />
      )}
    </div>
  );
}
