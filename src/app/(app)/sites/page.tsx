import { prisma } from "@/lib/db";
import { createSiteAction } from "./actions";
import { SiteList } from "./site-list";

export default async function SitesPage() {
  const sites = await prisma.site.findMany({
    include: {
      projects: {
        select: { _count: { select: { employees: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = sites.map((s) => ({
    id: s.id,
    name: s.name,
    projectCount: s.projects.length,
    employeeCount: s.projects.reduce((sum, p) => sum + p._count.employees, 0),
  }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sites</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the list of work sites available when adding timesheet
          entries manually.
        </p>
      </div>

      <form
        action={createSiteAction}
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[200px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Site name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Downtown Tower Site"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add Site
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No sites added yet. Add one above.
        </p>
      ) : (
        <SiteList sites={rows} />
      )}
    </div>
  );
}
