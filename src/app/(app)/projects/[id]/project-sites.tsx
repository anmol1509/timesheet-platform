"use client";

import { createSiteAction, deleteSiteAction } from "../actions";
import { DeleteButton } from "@/components/DeleteButton";

type Site = { id: string; name: string; address: string | null };

export function ProjectSites({
  projectId,
  sites,
}: {
  projectId: string;
  sites: Site[];
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {sites.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sites.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.address || "—"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <DeleteButton
                    action={deleteSiteAction}
                    hiddenFields={{ projectId, siteId: s.id }}
                    confirmMessage={`Remove site "${s.name}"?`}
                    label="Remove"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sites.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          No sites added yet.
        </p>
      )}
      <form
        action={createSiteAction}
        className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4 first:border-t-0"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Name</span>
          <input
            name="name"
            required
            placeholder="e.g. Plot 42, Building A"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block min-w-[200px] flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Address (optional)</span>
          <input
            name="address"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + Add
        </button>
      </form>
    </div>
  );
}
