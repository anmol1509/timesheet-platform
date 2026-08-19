"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Download, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import { DeleteButton } from "@/components/DeleteButton";
import { WciScanDialog } from "./wci-scan-dialog";
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
  parentId: string | null;
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

export function SupplierList({
  suppliers,
  wizardData,
}: {
  suppliers: SupplierRow[];
  /** Passed through to the registration dialog opened from a scanned name. */
  wizardData: React.ComponentProps<typeof WciScanDialog>["wizardData"];
}) {
  const router = useRouter();
  // Clients had a search box and these two didn't, so the same job worked
  // differently depending on which partner you were looking at.
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson || "").toLowerCase().includes(q) ||
        (s.parentName || "").toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  // A subsidiary belongs under its parent, not loose in an alphabetical list.
  // Searching flattens the tree, since hiding a match inside a collapsed parent
  // would look like the search found nothing.
  const searching = query.trim().length > 0;
  const childrenByParent = useMemo(() => {
    const map = new Map<string, SupplierRow[]>();
    for (const row of visible) {
      if (!row.parentId) continue;
      if (!map.has(row.parentId)) map.set(row.parentId, []);
      map.get(row.parentId)!.push(row);
    }
    return map;
  }, [visible]);

  const topLevel = useMemo(
    () =>
      searching
        ? visible
        : visible.filter((row) => !row.parentId || !childrenByParent.has(row.parentId)),
    [visible, searching, childrenByParent]
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    visible.map((s) => s.id)
  );

  function exportCsv() {
    const rows = selected.size > 0 ? suppliers.filter((s) => selected.has(s.id)) : visible;
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
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search supplier, parent or contact…"
          className="input w-full max-w-sm"
        />
        <span className="text-xs text-muted">
          {visible.length} of {suppliers.length}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
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
            {topLevel.flatMap((s) => {
              const children = childrenByParent.get(s.id) ?? [];
              const isOpen = expanded.has(s.id);
              return [s, ...(isOpen && !searching ? children : [])].map((row) => {
              const isChild = row.id !== s.id;
              return (
              <tr key={row.id} className={complianceRowClass(row.licenseStatus)}>
                <td className="px-4 py-3">
                  <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} />
                </td>
                <td className="px-4 py-3 font-medium text-primary">
                  <span
                    className="flex items-center gap-1.5"
                    style={isChild ? { paddingLeft: 18 } : undefined}
                  >
                    {!isChild && children.length > 0 && !searching ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(s.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Hide" : "Show"} ${children.length} subsidiaries of ${s.name}`}
                        className="rounded-sm p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
                      >
                        <ChevronRight
                          className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
                        />
                      </button>
                    ) : (
                      <span className="w-[18px]" />
                    )}
                    <Link href={`/suppliers/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                    {!isChild && children.length > 0 && (
                      <span className="text-xs font-normal text-subtle">
                        {children.length} subsidiar{children.length === 1 ? "y" : "ies"}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-secondary">{row.parentName || "—"}</td>
                <td className="px-4 py-3 text-secondary">
                  {row.contactPerson || row.contactPhone ? (
                    <>
                      {row.contactPerson && <div>{row.contactPerson}</div>}
                      {row.contactPhone && (
                        <div className="text-xs text-subtle">{row.contactPhone}</div>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.employeeCount > 0 ? (
                    <Link
                      href={`/employees?supplier=${row.id}`}
                      className="text-[var(--brand-primary)] hover:underline"
                    >
                      {row.employeeCount}
                    </Link>
                  ) : (
                    <span className="text-secondary">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-secondary">{row.entryCount}</td>
                <td className="px-4 py-3">
                  <Badge color={row.status === "ACTIVE" ? "green" : "red"}>{row.status}</Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3">
                  {/* Every company insures its own people, so a subsidiary
                      needs its own certificate upload, not the parent's. */}
                  <WciScanDialog
                    supplierId={row.id}
                    supplierName={row.name}
                    wizardData={wizardData}
                  />
                  <Link
                    href={`/suppliers/${row.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <DeleteButton
                    action={deleteSupplierAction}
                    hiddenFields={{ supplierId: row.id }}
                    confirmMessage={`Delete supplier "${row.name}"?${
                      row.employeeCount > 0
                        ? ` ${row.employeeCount} employee(s) will be unassigned.`
                        : ""
                    }`}
                  />
                  </div>
                </td>
              </tr>
              );
              });
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            No supplier matches “{query}”.
          </p>
        )}
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
