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
    <div className="card overflow-hidden">
      {sites.length > 0 && (
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sites.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-primary">{s.name}</td>
                <td className="px-4 py-3 text-secondary">{s.address || "—"}</td>
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
        <p className="px-4 py-8 text-center text-sm text-muted">
          No sites added yet.
        </p>
      )}
      <form
        action={createSiteAction}
        className="flex flex-wrap items-end gap-3 border-t border-default p-4 first:border-t-0"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <label className="block min-w-[160px] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Name</span>
          <input
            name="name"
            required
            placeholder="e.g. Plot 42, Building A"
            className="input w-full"
          />
        </label>
        <label className="block min-w-[200px] flex-1">
          <span className="mb-1 block text-xs font-medium text-muted">Address (optional)</span>
          <input
            name="address"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          + Add
        </button>
      </form>
    </div>
  );
}
