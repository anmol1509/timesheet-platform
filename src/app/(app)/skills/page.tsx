import { prisma } from "@/lib/db";
import { createSkillAction } from "./actions";
import { SkillTable } from "./skill-table";

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
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Skill name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Welding"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Category
          </span>
          <input
            name="category"
            placeholder="e.g. Technical"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
          <input type="checkbox" name="trending" className="h-4 w-4" />
          Trending
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90"
        >
          + Add Skill
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No skills tracked yet. Add one above, or tag skills from an
          employee&rsquo;s profile.
        </p>
      ) : (
        <SkillTable skills={rows} />
      )}
    </div>
  );
}
