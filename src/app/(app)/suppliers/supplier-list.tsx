"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { toCsv, downloadCsv } from "@/lib/csv";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { useRowSelection } from "@/lib/useRowSelection";
import { bulkImportSuppliersAction, deleteSupplierAction } from "./actions";

type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
  status: string;
  parentName: string | null;
  employeeCount: number;
  entryCount: number;
  licenseStatus: ComplianceStatus;
};

const IMPORT_COLUMNS = [
  { key: "name", label: "Supplier name", required: true },
  { key: "fullName", label: "Full name" },
  { key: "contactPerson", label: "Contact person" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "contactEmail", label: "Contact email" },
  { key: "tradeLicenseNumber", label: "Trade license number" },
];

export function SupplierList({ suppliers }: { suppliers: SupplierRow[] }) {
  const router = useRouter();
  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    suppliers.map((s) => s.id)
  );

  function exportCsv() {
    const rows = selected.size > 0 ? suppliers.filter((s) => selected.has(s.id)) : suppliers;
    const csv = toCsv(rows, [
      { header: "Supplier", value: (s) => s.name },
      { header: "Contact Person", value: (s) => s.contactPerson },
      { header: "Contact Phone", value: (s) => s.contactPhone },
      { header: "Employees", value: (s) => s.employeeCount },
      { header: "Timesheet Rows", value: (s) => s.entryCount },
      { header: "Status", value: (s) => s.status },
    ]);
    downloadCsv(`suppliers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <CsvImportDialog
          entityLabel="suppliers"
          columns={IMPORT_COLUMNS}
          importAction={bulkImportSuppliersAction}
          onDone={() => router.refresh()}
        />
        <button
          type="button"
          onClick={exportCsv}
          className="btn btn-secondary flex gap-1.5 px-3"
        >
          <Download className="h-4 w-4" />
          {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
              </th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Parent</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 text-right">Employees</th>
              <th className="px-4 py-3 text-right">Timesheet rows</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {suppliers.map((s) => (
              <tr key={s.id} className={complianceRowClass(s.licenseStatus)}>
                <td className="px-4 py-3">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                </td>
                <td className="px-4 py-3 font-medium text-primary">
                  <Link href={`/suppliers/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-secondary">{s.parentName || "—"}</td>
                <td className="px-4 py-3 text-secondary">
                  {s.contactPerson || s.contactPhone ? (
                    <>
                      {s.contactPerson && <div>{s.contactPerson}</div>}
                      {s.contactPhone && (
                        <div className="text-xs text-subtle">{s.contactPhone}</div>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {s.employeeCount > 0 ? (
                    <Link
                      href={`/employees?supplier=${s.id}`}
                      className="text-[var(--brand-primary)] hover:underline"
                    >
                      {s.employeeCount}
                    </Link>
                  ) : (
                    <span className="text-secondary">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-secondary">{s.entryCount}</td>
                <td className="px-4 py-3">
                  <Badge color={s.status === "ACTIVE" ? "green" : "red"}>{s.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    href={`/suppliers/${s.id}`}
                    className="mr-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <DeleteButton
                    action={deleteSupplierAction}
                    hiddenFields={{ supplierId: s.id }}
                    confirmMessage={`Delete supplier "${s.name}"?${
                      s.employeeCount > 0
                        ? ` ${s.employeeCount} employee(s) will be unassigned.`
                        : ""
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected.size > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-muted hover:underline"
        >
          Clear selection ({selected.size})
        </button>
      )}
    </div>
  );
}
