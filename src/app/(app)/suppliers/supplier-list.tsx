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
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
              </th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3 text-right">Employees</th>
              <th className="px-4 py-3 text-right">Timesheet rows</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.map((s) => (
              <tr key={s.id} className={complianceRowClass(s.licenseStatus)}>
                <td className="px-4 py-3">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/suppliers/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {s.contactPerson || s.contactPhone ? (
                    <>
                      {s.contactPerson && <div>{s.contactPerson}</div>}
                      {s.contactPhone && (
                        <div className="text-xs text-slate-400">{s.contactPhone}</div>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{s.employeeCount}</td>
                <td className="px-4 py-3 text-right text-slate-600">{s.entryCount}</td>
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
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Clear selection ({selected.size})
        </button>
      )}
    </div>
  );
}
