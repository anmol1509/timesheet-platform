"use client";

import { useState, useTransition } from "react";
import {
  addProjectInventoryAction,
  returnProjectInventoryAction,
  removeProjectInventoryAction,
} from "../actions";
import { Combobox } from "@/components/ui/Combobox";
import { DeleteButton } from "@/components/DeleteButton";

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
      <div className="card overflow-hidden">
        {active.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {active.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-primary">{a.item.name}</td>
                  <td className="px-4 py-3 text-right text-secondary">{a.quantity}</td>
                  <td className="px-4 py-3 text-secondary">{fmtDate(a.assignedDate)}</td>
                  <td className="px-4 py-3 text-secondary">{a.condition || "—"}</td>
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
                    <DeleteButton
                      action={removeProjectInventoryAction}
                      hiddenFields={{ projectId, assignmentId: a.id }}
                      confirmMessage={`Remove "${a.item.name}" from this project's equipment?`}
                      label="Remove"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No equipment currently assigned.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-3 border-t border-default p-4">
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Item</span>
            <Combobox
              value={itemName}
              onChange={setItemName}
              placeholder="e.g. Safety Harness"
              options={catalog.map((name) => ({ value: name, label: name }))}
            />
          </label>
          <label className="block w-20">
            <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Assigned date
            </span>
            <input
              type="date"
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">
              Condition (optional)
            </span>
            <input
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. Good"
              className="input w-full"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={add}
            className="btn btn-primary"
          >
            + Add
          </button>
        </div>
      </div>

      {returned.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">
            Returned
          </h3>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {returned.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 text-secondary">{a.item.name}</td>
                    <td className="px-4 py-3 text-right text-muted">{a.quantity}</td>
                    <td className="px-4 py-3 text-muted">
                      Returned {fmtDate(a.returnDate!)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteButton
                        action={removeProjectInventoryAction}
                        hiddenFields={{ projectId, assignmentId: a.id }}
                        confirmMessage={`Remove "${a.item.name}" from this project's equipment history?`}
                        label="Remove"
                      />
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
