"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { issueEmployeeInventoryAction, returnEmployeeInventoryAssignmentAction } from "../../employees/[id]/actions";

type Assignment = {
  id: string;
  quantity: number;
  issuedDate: string;
  returnDate: string | null;
  condition: string | null;
  notes: string | null;
  employee: { id: string; name: string; employeeIdNo: string };
};

type EmployeeOption = { id: string; name: string; employeeIdNo: string };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// A single item can go to several employees, on the same day or different
// days — each Assign is its own row, not a per-employee slot. Issuing from
// here is the same EmployeeInventoryAssignment/action pair as the employee's
// own Trades & Records tab; this is just the item-first way in.
export function EmployeeIssuanceSection({
  itemId,
  assignments,
  employees,
}: {
  itemId: string;
  assignments: Assignment[];
  employees: EmployeeOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [employeeId, setEmployeeId] = useState("");
  const quantityRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const conditionRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  function handleAssign() {
    if (!employeeId) return;
    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("itemId", itemId);
    formData.append("quantity", quantityRef.current?.value || "1");
    formData.append("issuedDate", dateRef.current?.value || today);
    if (conditionRef.current?.value) formData.append("condition", conditionRef.current.value);
    if (notesRef.current?.value) formData.append("notes", notesRef.current.value);

    startTransition(() => {
      issueEmployeeInventoryAction(formData);
    });

    setEmployeeId("");
    if (quantityRef.current) quantityRef.current.value = "1";
    if (dateRef.current) dateRef.current.value = today;
    if (conditionRef.current) conditionRef.current.value = "";
    if (notesRef.current) notesRef.current.value = "";
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">Issued to Employees</h2>
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Employee</span>
            <Select
              value={employeeId}
              onChange={setEmployeeId}
              placeholder="Choose an employee"
              options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeIdNo})` }))}
            />
          </label>
          <label className="block w-20">
            <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
            <input ref={quantityRef} type="number" min={1} defaultValue={1} className="input w-full" />
          </label>
          <label className="block min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-muted">Date issued</span>
            <input ref={dateRef} type="date" defaultValue={today} className="input w-full" />
          </label>
          <label className="block min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-muted">Condition</span>
            <input ref={conditionRef} placeholder="e.g. New" className="input w-full" />
          </label>
          <label className="block min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Notes</span>
            <input ref={notesRef} placeholder="Optional" className="input w-full" />
          </label>
          <button
            type="button"
            onClick={handleAssign}
            disabled={pending || !employeeId}
            className="btn btn-primary"
          >
            Assign
          </button>
        </div>

        {assignments.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">Never issued to an employee.</p>
        ) : (
          <div className="mt-4 overflow-hidden overflow-x-auto rounded-card border border-default">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2">Issued</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 font-medium text-primary">
                      <Link href={`/employees/${a.employee.id}`} className="hover:underline">
                        {a.employee.name}
                      </Link>
                      <span className="tabular ml-2 text-xs text-subtle">{a.employee.employeeIdNo}</span>
                      {a.condition && <span className="ml-1.5 text-xs text-subtle">({a.condition})</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">{a.quantity}</td>
                    <td className="px-3 py-2 text-secondary">{formatDate(a.issuedDate)}</td>
                    <td className="px-3 py-2">
                      {a.returnDate ? (
                        <Badge color="slate">Returned {formatDate(a.returnDate)}</Badge>
                      ) : (
                        <Badge color="amber">Holding</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-secondary">{a.notes || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {!a.returnDate && (
                        <form action={returnEmployeeInventoryAssignmentAction} className="inline">
                          <input type="hidden" name="employeeId" value={a.employee.id} />
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <button type="submit" className="text-xs font-medium text-blue-600 hover:underline">
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
      </div>
    </section>
  );
}
