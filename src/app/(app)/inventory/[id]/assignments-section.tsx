"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { assignInventoryItemAction, returnInventoryAssignmentAction } from "../actions";

type Assignment = {
  id: string;
  quantity: number;
  assignedDate: string;
  returnDate: string | null;
  condition: string | null;
  project: { id: string; name: string; code: string };
};

export function AssignmentsSection({
  itemId,
  assignments,
  projects,
}: {
  itemId: string;
  assignments: Assignment[];
  projects: { id: string; name: string; code: string }[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Assignments</h2>

      <form
        action={assignInventoryItemAction}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="itemId" value={itemId} />
        <label className="block min-w-[220px] flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Project</span>
          <Select
            name="projectId"
            placeholder="Choose a project"
            options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </label>
        <label className="block w-24">
          <span className="mb-1 block text-xs font-medium text-slate-500">Qty</span>
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <label className="block min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">Condition</span>
          <input
            name="condition"
            placeholder="e.g. Good"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          Assign
        </button>
      </form>

      {assignments.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Never assigned to a project.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/projects/${a.project.id}`} className="hover:underline">
                      {a.project.code} — {a.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{a.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(a.assignedDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {a.returnDate ? (
                      <Badge color="slate">
                        Returned {new Date(a.returnDate).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Badge color="amber">In use</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!a.returnDate && (
                      <form action={returnInventoryAssignmentAction}>
                        <input type="hidden" name="itemId" value={itemId} />
                        <input type="hidden" name="assignmentId" value={a.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Mark returned
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
