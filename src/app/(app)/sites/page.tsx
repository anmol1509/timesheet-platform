import { prisma } from "@/lib/db";
import { DeleteButton } from "@/components/DeleteButton";
import { InlineEditRow } from "@/components/InlineEditRow";
import { createSiteAction, updateSiteAction, deleteSiteAction } from "./actions";

export default async function SitesPage() {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sites</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage the list of work sites available when adding timesheet
          entries manually.
        </p>
      </div>

      <form
        action={createSiteAction}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
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
          className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90"
        >
          + Add Site
        </button>
      </form>

      {sites.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No sites added yet. Add one above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sites.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <InlineEditRow
                      value={s.name}
                      action={updateSiteAction}
                      hiddenFields={{ siteId: s.id }}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton
                      action={deleteSiteAction}
                      hiddenFields={{ siteId: s.id }}
                      confirmMessage={`Delete site "${s.name}"?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
