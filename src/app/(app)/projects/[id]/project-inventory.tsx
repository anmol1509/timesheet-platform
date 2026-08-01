"use client";

import { useState, useTransition } from "react";
import {
  addProjectInventoryAction,
  returnProjectInventoryAction,
  removeProjectInventoryAction,
} from "../actions";

type Assignment = {
  id: string;
  quantity: number;
  assignedDate: Date;
  returnDate: Date | null;
  condition: string | null;
  item: { name: string; category: string | null };
};

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ProjectInventory({
  projectId,
  assignments,
  catalog,
}: {
  projectId: string;
  assignments: Assignment[];
  catalog: string[];
}) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [assignedDate, setAssignedDate] = useState("");
  const [condition, setCondition] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!itemName.trim()) return;
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("itemName", itemName.trim());
    formData.set("quantity", quantity || "1");
    formData.set("assignedDate", assignedDate);
    formData.set("condition", condition);
    startTransition(async () => {
      await addProjectInventoryAction(formData);
      setItemName("");
      setQuantity("1");
      setAssignedDate("");
      setCondition("");
    });
  }

  const active = assignments.filter((a) => !a.returnDate);
  const returned = assignments.filter((a) => a.returnDate);

  return (
    <div className="space-y-4">
      <datalist id="inventory-catalog">
        {catalog.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {active.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {active.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{a.item.name}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{a.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(a.assignedDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{a.condition || "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <form action={returnProjectInventoryAction} className="mr-3 inline">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Mark returned
                      </button>
                    </form>
                    <form action={removeProjectInventoryAction} className="inline">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <button
                        type="submit"
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            No equipment currently assigned.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 p-4">
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Item</span>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              list="inventory-catalog"
              placeholder="e.g. Safety Harness"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <label className="block w-20">
            <span className="mb-1 block text-xs font-medium text-slate-500">Qty</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Assigned date
            </span>
            <input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Condition (optional)
            </span>
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. Good"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={add}
            className="rounded-lg bg-[#0B1642] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0B1642]/90 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      </div>

      {returned.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Returned
          </h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {returned.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-slate-600">{a.item.name}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{a.quantity}</td>
                    <td className="px-4 py-3 text-slate-500">
                      Returned {fmtDate(a.returnDate!)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={removeProjectInventoryAction}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="assignmentId" value={a.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
