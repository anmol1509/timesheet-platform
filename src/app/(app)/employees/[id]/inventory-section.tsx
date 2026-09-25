"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/Badge";
import { Select } from "@/components/ui/Select";
import { issueEmployeeInventoryAction, returnEmployeeInventoryAssignmentAction } from "./actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumberInput } from "@/components/ui/NumberInput";

type Assignment = {
  id: string;
  quantity: number;
  issuedDate: string;
  returnDate: string | null;
  condition: string | null;
  notes: string | null;
  item: { id: string; name: string; category: string | null };
  variant: { id: string; name: string } | null;
};

type VariantOption = { id: string; name: string; available: number };
type ItemOption = { id: string; name: string; category: string | null; variants: VariantOption[] };

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function InventorySection({
  employeeId,
  assignments,
  items,
}: {
  employeeId: string;
  assignments: Assignment[];
  items: ItemOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [itemId, setItemId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const conditionRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const selectedItem = items.find((i) => i.id === itemId) ?? null;
  const hasVariants = (selectedItem?.variants.length ?? 0) > 0;

  // Still-held units of the item currently selected in the form — the
  // control-misuse signal a supervisor actually needs before handing out
  // another one.
  const heldByEmployee = useMemo(
    () => assignments.filter((a) => a.item.id === itemId && !a.returnDate),
    [assignments, itemId]
  );

  function handleIssue() {
    if (!itemId) return;
    if (hasVariants && !variantId) return;
    if (heldByEmployee.length > 0 && !acknowledged) return;
    setError(null);

    const formData = new FormData();
    formData.append("employeeId", employeeId);
    formData.append("itemId", itemId);
    if (variantId) formData.append("variantId", variantId);
    formData.append("quantity", quantityRef.current?.value || "1");
    formData.append("issuedDate", dateRef.current?.value || today);
    if (conditionRef.current?.value) formData.append("condition", conditionRef.current.value);
    if (notesRef.current?.value) formData.append("notes", notesRef.current.value);

    startTransition(async () => {
      const result = await issueEmployeeInventoryAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setItemId("");
      setVariantId("");
      setAcknowledged(false);
      setResetKey((k) => k + 1);
      if (quantityRef.current) quantityRef.current.value = "1";
      if (conditionRef.current) conditionRef.current.value = "";
      if (notesRef.current) notesRef.current.value = "";
      if (dateRef.current) dateRef.current.value = today;
    });
  }

  const blocked =
    !itemId || (hasVariants && !variantId) || (heldByEmployee.length > 0 && !acknowledged);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">PPE &amp; Inventory Issued</h2>
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1 block text-xs font-medium text-muted">Item</span>
            <Select
              value={itemId}
              onChange={(value) => {
                setItemId(String(value));
                setVariantId("");
                setAcknowledged(false);
                setError(null);
              }}
              placeholder="Choose an item"
              options={items.map((i) => ({
                value: i.id,
                label: i.category ? `${i.name} (${i.category})` : i.name,
              }))}
            />
          </label>
          {hasVariants && (
            <label className="block min-w-[180px]">
              <span className="mb-1 block text-xs font-medium text-muted">Variant</span>
              <Select
                value={variantId}
                onChange={setVariantId}
                placeholder="Choose a variant"
                options={(selectedItem?.variants ?? []).map((v) => ({
                  value: v.id,
                  label: `${v.name} (${v.available} available)`,
                }))}
              />
            </label>
          )}
          <label className="block w-20">
            <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
            <NumberInput key={resetKey} defaultValue={1} min={1} inputRef={quantityRef} className="w-full" />
          </label>
          <label className="block min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-muted">Date issued</span>
            <DatePicker key={resetKey} defaultValue={today} inputRef={dateRef} className="w-full" />
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
            onClick={handleIssue}
            disabled={pending || blocked}
            className="btn btn-primary"
          >
            Issue
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {heldByEmployee.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-control bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>
              Already holds {heldByEmployee.reduce((n, a) => n + a.quantity, 0)} unreturned unit
              {heldByEmployee.reduce((n, a) => n + a.quantity, 0) === 1 ? "" : "s"} of this item
              (issued {formatDate(heldByEmployee[0].issuedDate)}) — confirm before issuing another.
            </span>
            <label className="flex items-center gap-1.5 font-medium">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              Issue anyway
            </label>
          </div>
        )}

        {assignments.length === 0 ? (
          <p className="mt-4 text-sm text-subtle">Nothing issued to this employee yet.</p>
        ) : (
          <div className="mt-4 overflow-hidden overflow-x-auto rounded-2xl border border-default">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Item</th>
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
                      {a.item.name}
                      {a.variant && <span className="ml-1.5 text-xs text-subtle">— {a.variant.name}</span>}
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
                          <input type="hidden" name="employeeId" value={employeeId} />
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
