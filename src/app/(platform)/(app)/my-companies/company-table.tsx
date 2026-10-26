"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { SupplierEmployeePanel } from "../suppliers/supplier-employee-panel";
import { SupplierDrawer, type SupplierPerson } from "../suppliers/supplier-drawer";

export type DocSummary = { missing: number; expired: number; expiring: number };
export type CompanyRow = {
  id: string; name: string; code: string | null; fullName: string | null; status: string; employees: number; people: number;
  own: DocSummary; owners: DocSummary; ownership: { owners: number; total: number; ok: boolean }; sub: boolean;
  branchId: string | null; parentId: string | null; parentName: string | null;
};

const attention = (s: DocSummary) => s.missing + s.expired + s.expiring > 0;
const summaryText = (s: DocSummary) => (!attention(s) ? "In order" : [s.expired && `${s.expired} expired`, s.missing && `${s.missing} missing`, s.expiring && `${s.expiring} expiring`].filter(Boolean).join(", "));

/** Owners hold shares that add up to 100; anything else needs fixing. */
function Ownership({ o }: { o: CompanyRow["ownership"] }) {
  if (o.owners === 0) return <span className="text-muted">No owners</span>;
  return o.ok ? <Badge color="green">100%</Badge> : <Badge color="amber">{o.total}% set</Badge>;
}

/** One compact status per area: what needs doing, worst first, or "In order". */
function Status({ s }: { s: DocSummary }) {
  if (!attention(s)) return <Badge color="green">In order</Badge>;
  return (
    <span className="flex flex-wrap gap-1">
      {s.expired > 0 && <Badge color="red">{s.expired} expired</Badge>}
      {s.missing > 0 && <Badge color="red">{s.missing} missing</Badge>}
      {s.expiring > 0 && <Badge color="amber">{s.expiring} expiring</Badge>}
    </span>
  );
}

/**
 * Your own companies in the same table the Suppliers page uses: click a row for the side panel (details, trade licence scan,
 * documents, workmen compensation), the people icon for employees and insurance, search, filters, column picker and CSV.
 * `canSuppliers` is whether the person may use the supplier tools behind the side panel; without it a row opens the company page.
 */
export function CompanyTable({ rows, canSuppliers, wizardData }: { rows: CompanyRow[]; canSuppliers: boolean; wizardData: React.ComponentProps<typeof SupplierEmployeePanel>["wizardData"] }) {
  // The quick view steps through the rows as they were filtered and sorted when it opened.
  const [drawer, setDrawer] = useState<{ id: string; order: string[] } | null>(null);
  const people = useMemo(() => new Map<string, SupplierPerson>(rows.map((r) => [r.id, { id: r.id, name: r.name, employeeCount: r.employees, billBalance: 0, billOverdue: 0, parentName: r.parentName }])), [rows]);

  const columns: DataTableColumn<CompanyRow>[] = [
    {
      key: "name",
      header: "Company",
      locked: true,
      csvHeader: "Company name",
      sortValue: (r) => r.name,
      searchValue: (r) => `${r.name} ${r.code ?? ""} ${r.fullName ?? ""} ${r.parentName ?? ""}`,
      csvValue: (r) => r.name,
      render: (row, ctx) => {
        const isChild = (ctx?.depth ?? 0) > 0;
        const childCount = ctx?.childCount ?? 0;
        return (
          <div className="font-medium text-primary">
            <span className="flex items-center gap-1.5" style={isChild ? { paddingLeft: 18 } : undefined}>
              {childCount > 0 ? (
                <button type="button" onClick={ctx?.toggle} aria-expanded={ctx?.expanded} aria-label={`${ctx?.expanded ? "Hide" : "Show"} ${childCount} subsidiaries of ${row.name}`} className="rounded-sm p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary">
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ctx?.expanded && "rotate-90")} />
                </button>
              ) : (
                <span className="w-[18px]" />
              )}
              <span className="hover:underline">{row.name}</span>
              {childCount > 0 && <span className="text-xs font-normal text-subtle">{childCount} subsidiar{childCount === 1 ? "y" : "ies"}</span>}
            </span>
            {row.fullName && row.fullName !== row.name && <div className="mt-0.5 truncate text-xs font-normal text-muted" style={{ paddingLeft: isChild ? 36 : 20 }}>{row.fullName}</div>}
          </div>
        );
      },
    },
    { key: "code", header: "Code", csvHeader: "Code", sortValue: (r) => r.code, csvValue: (r) => r.code, render: (r) => <span className="tabular text-secondary">{r.code ?? "—"}</span> },
    { key: "employees", header: "Employees", align: "right", csvHeader: "Employees", sortValue: (r) => r.employees, csvValue: (r) => r.employees, render: (r) => <span className="tabular text-secondary">{r.employees}</span> },
    { key: "people", header: "Owners & sponsors", align: "right", csvHeader: "Owners and sponsors", sortValue: (r) => r.people, csvValue: (r) => r.people, render: (r) => <span className="tabular text-secondary">{r.people}</span> },
    {
      key: "ownership", header: "Ownership", csvHeader: "Ownership",
      sortValue: (r) => (r.ownership.owners === 0 ? -1 : r.ownership.total),
      csvValue: (r) => (r.ownership.owners === 0 ? "No owners" : r.ownership.ok ? "100%" : `${r.ownership.total}% set`),
      render: (r) => <Ownership o={r.ownership} />,
    },
    { key: "own", header: "Company documents", csvHeader: "Company documents", sortValue: (r) => r.own.expired * 100 + r.own.missing * 10 + r.own.expiring, csvValue: (r) => summaryText(r.own), render: (r) => <Status s={r.own} /> },
    {
      key: "owners", header: "Owner & sponsor documents", csvHeader: "Owner and sponsor documents",
      sortValue: (r) => (r.people === 0 ? -1 : r.owners.expired * 100 + r.owners.missing * 10 + r.owners.expiring),
      csvValue: (r) => (r.people === 0 ? "None added" : summaryText(r.owners)),
      render: (r) => (r.people === 0 ? <span className="text-muted">None added</span> : <Status s={r.owners} />),
    },
    { key: "status", header: "Status", csvHeader: "Status", sortValue: (r) => r.status, csvValue: (r) => r.status, render: (r) => <Badge dot color={r.status === "ACTIVE" ? "green" : "red"}>{r.status}</Badge> },
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        tree={{ parentId: (r) => r.parentId }}
        onRowClick={canSuppliers ? (row, ordered) => setDrawer({ id: row.id, order: ordered.map((r) => r.id) }) : undefined}
        searchable
        searchPlaceholder="Search company, code or parent…"
        pageSize={50}
        csvFilename={`my-companies-${new Date().toISOString().slice(0, 10)}.csv`}
        filters={[
          { key: "status", label: "All statuses", options: [{ value: "ACTIVE", label: "Active" }, { value: "BLACKLISTED", label: "Blacklisted" }], get: (r) => r.status },
          { key: "type", label: "All companies", options: [{ value: "primary", label: "Primary companies" }, { value: "sub", label: "Subsidiaries" }], get: (r) => (r.sub ? "sub" : "primary") },
          { key: "docs", label: "Any documents", options: [{ value: "attention", label: "Needs attention" }, { value: "ok", label: "All in order" }], get: (r) => (attention(r.own) || attention(r.owners) ? "attention" : "ok") },
          { key: "ownership", label: "Any ownership", options: [{ value: "bad", label: "Shares don't add up" }, { value: "none", label: "No owners" }, { value: "ok", label: "100% set" }], get: (r) => (r.ownership.owners === 0 ? "none" : r.ownership.ok ? "ok" : "bad") },
        ]}
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-3">
            {canSuppliers && <SupplierEmployeePanel supplierId={row.id} supplierName={row.name} supplierBranchId={row.branchId} wizardData={wizardData} />}
            <Link href={`/suppliers/${row.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Link>
          </div>
        )}
        emptyState={<p className="px-4 py-8 text-center text-muted">No companies match.</p>}
      />
      {drawer && <SupplierDrawer id={drawer.id} order={drawer.order} people={people} onNavigate={(id) => setDrawer({ id, order: drawer.order })} onClose={() => setDrawer(null)} />}
    </>
  );
}
