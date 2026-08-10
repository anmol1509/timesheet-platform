"use client";

import { useState, useTransition } from "react";
import { uploadAttachmentAction } from "@/lib/attachments";
import { createEmployeesFromInsuranceAction } from "../actions";
import type { ExtractedEmployeesResult } from "@/app/api/documents/extract-employees/route";

type RowState = {
  id: string;
  employeeIdNo: string;
  name: string;
  category: string;
  designation: string;
  salary: string;
};

function idPrefix(supplierName: string) {
  const letters = supplierName
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, "").slice(0, 1))
    .join("")
    .toUpperCase();
  return letters || "EMP";
}

export function WorkmenCompImport({
  supplierId,
  supplierName,
  entityBranchId,
}: {
  supplierId: string;
  supplierName: string;
  entityBranchId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<RowState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);

    // Archive the certificate itself as a normal Supplier attachment.
    const attachmentForm = new FormData();
    attachmentForm.append("entityType", "SUPPLIER");
    attachmentForm.append("entityId", supplierId);
    attachmentForm.append("entityBranchId", entityBranchId ?? "");
    attachmentForm.append("docType", "WORKMEN_COMPENSATION_INSURANCE");
    attachmentForm.append("revalidate", `/suppliers/${supplierId}`);
    attachmentForm.append("file", file);
    await uploadAttachmentAction(attachmentForm);

    // Extract the employee table from the same file.
    setExtracting(true);
    try {
      const extractForm = new FormData();
      extractForm.append("file", file);
      const res = await fetch("/api/documents/extract-employees", { method: "POST", body: extractForm });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Extraction failed.");
        return;
      }
      const data = (await res.json()) as ExtractedEmployeesResult;
      const prefix = idPrefix(supplierName);
      setRows(
        data.employees.map((e, i) => ({
          id: crypto.randomUUID(),
          employeeIdNo: `${prefix}${i + 1}`,
          name: e.name || "",
          category: e.category || "",
          designation: e.designation || "",
          salary: e.salary || "",
        }))
      );
    } catch {
      setError("Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), employeeIdNo: "", name: "", category: "", designation: "", salary: "" },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleSave() {
    const payload = rows
      .filter((r) => r.employeeIdNo.trim() && r.name.trim())
      .map((r) => ({
        employeeIdNo: r.employeeIdNo.trim(),
        name: r.name.trim(),
        category: r.category.trim() || null,
        designation: r.designation.trim() || null,
        salary: r.salary.trim() || null,
      }));
    startTransition(async () => {
      const res = await createEmployeesFromInsuranceAction(supplierId, payload);
      const parts = [`Created ${res.created} of ${res.requested} rows.`];
      if (res.errors.length > 0) {
        parts.push(...res.errors.map((e) => `Row ${e.row}: ${e.message}`));
      }
      setResult(parts.join(" "));
      if (res.created > 0) {
        setRows((prev) => prev.filter((r) => !payload.some((p) => p.employeeIdNo === r.employeeIdNo)));
      }
    });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Workmen Compensation Insurance</h2>
        <p className="mt-1 text-xs text-slate-500">
          Upload the insurance certificate — it&rsquo;s archived below under Documents, and the employee
          schedule is read automatically into an editable table you can review before creating records.
        </p>
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
        className="text-sm"
      />

      {extracting && <p className="text-sm text-slate-500">Reading the certificate…</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-2 py-2">Employee ID</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Designation</th>
                  <th className="px-2 py-2">Salary</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.employeeIdNo}
                        onChange={(e) => updateRow(r.id, { employeeIdNo: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.category}
                        onChange={(e) => updateRow(r.id, { category: e.target.value })}
                        className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.designation}
                        onChange={(e) => updateRow(r.id, { designation: e.target.value })}
                        className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.salary}
                        onChange={(e) => updateRow(r.id, { salary: e.target.value })}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              + Add row
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {pending ? "Saving…" : `Save ${rows.length} Employees`}
            </button>
          </div>
        </div>
      )}

      {result && <p className="text-sm text-slate-600">{result}</p>}
    </section>
  );
}
