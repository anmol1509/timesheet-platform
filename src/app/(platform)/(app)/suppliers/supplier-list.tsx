"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { cn } from "@/lib/cn";
import { DeleteButton } from "@/components/DeleteButton";
import { SupplierEmployeePanel } from "./supplier-employee-panel";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { bulkImportSuppliersAction, deleteSupplierAction } from "./actions";

type SupplierRow = {
  id: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  fullName: string | null;
  trn: string | null;
  tradeLicenseNumber: string | null;
  status: string;
  isOwnCompany: boolean;
  parentName: string | null;
  parentId: string | null;
  branchId: string | null;
  employeeCount: number;
  entryCount: number;
  licenseStatus: ComplianceStatus;
  licenseExpiry: string | null;
  category: string | null;
  approvals: { project: string; labour: string; invoicing: string };
  billBalance: number;
  billOverdue: number;
};

const APPROVAL_GATES: { key: "project" | "labour" | "invoicing"; label: string }[] = [
  { key: "project", label: "Projects" },
  { key: "labour", label: "Labour" },
  { key: "invoicing", label: "Invoicing" },
];
const GATE_TONE: Record<string, string> = {
  Approved: "bg-[var(--success)]",
  Pending: "bg-[var(--warning)]",
  Rejected: "bg-[var(--error)]",
};
const fmtAed = (n: number) => Math.round(n).toLocaleString();
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const IMPORT_COLUMNS = [
  { key: "name", label: "Supplier name", required: true, aliases: ["Supplier", "Name"] },
  { key: "code", label: "Supplier code", aliases: ["Code"] },
  { key: "parent", label: "Parent supplier", aliases: ["Parent", "Parent company"] },
  { key: "fullName", label: "Full name" },
  { key: "contactPerson", label: "Contact person" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "contactEmail", label: "Contact email" },
  { key: "tradeLicenseNumber", label: "Trade license number" },
  { key: "category", label: "Category" },
  { key: "trn", label: "TRN" },
];

export function SupplierList({
  suppliers,
  wizardData,
}: {
  suppliers: SupplierRow[];
  /** Passed through to the registration dialog opened from a scanned name. */
  wizardData: React.ComponentProps<typeof SupplierEmployeePanel>["wizardData"];
}) {
  const categoryOptions = [...new Set(suppliers.map((s) => s.category).filter((c): c is string => !!c))].sort().map((v) => ({ value: v, label: v }));

  // The first columns are named exactly as the import expects, so an exported
  // file can be edited in Excel and imported back; the ones after are for reading.
  const columns: DataTableColumn<SupplierRow>[] = [
    {
      key: "name",
      header: "Supplier",
      locked: true,
      csvHeader: "Supplier name",
      sortValue: (s) => s.name,
      searchValue: (s) => `${s.name} ${s.code ?? ""} ${s.contactPerson ?? ""} ${s.parentName ?? ""}`,
      csvValue: (s) => s.name,
      render: (row, ctx) => {
        const isChild = (ctx?.depth ?? 0) > 0;
        const childCount = ctx?.childCount ?? 0;
        return (
          <div className="font-medium text-primary">
            <span className="flex items-center gap-1.5" style={isChild ? { paddingLeft: 18 } : undefined}>
              {childCount > 0 ? (
                <button
                  type="button"
                  onClick={ctx?.toggle}
                  aria-expanded={ctx?.expanded}
                  aria-label={`${ctx?.expanded ? "Hide" : "Show"} ${childCount} subsidiaries of ${row.name}`}
                  className="rounded-sm p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ctx?.expanded && "rotate-90")} />
                </button>
              ) : (
                <span className="w-[18px]" />
              )}
              <Link href={`/suppliers/${row.id}`} className="hover:underline">
                {row.name}
              </Link>
              {row.isOwnCompany && (
                <span title="Own company">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" aria-label="Own company" />
                </span>
              )}
              {childCount > 0 && (
                <span className="text-xs font-normal text-subtle">
                  {childCount} subsidiar{childCount === 1 ? "y" : "ies"}
                </span>
              )}
            </span>
            <div className="tabular mt-0.5 text-xs font-normal text-muted" style={{ paddingLeft: isChild ? 36 : 20 }}>
              {[row.category, row.parentName && `Sub of ${row.parentName}`].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        );
      },
    },
    {
      key: "code",
      header: "Code",
      csvHeader: "Supplier code",
      sortValue: (s) => s.code,
      csvValue: (s) => s.code,
      render: (s) => <span className="tabular text-muted">{s.code || "—"}</span>,
    },
    {
      key: "parent",
      header: "Parent supplier",
      csvHeader: "Parent supplier",
      defaultHidden: true,
      sortValue: (s) => s.parentName,
      csvValue: (s) => s.parentName,
      render: (s) => s.parentName ?? <span className="text-subtle">—</span>,
    },
    {
      key: "fullName",
      header: "Full name",
      csvHeader: "Full name",
      defaultHidden: true,
      sortValue: (s) => s.fullName,
      searchValue: (s) => s.fullName,
      csvValue: (s) => s.fullName,
      render: (s) => s.fullName ?? <span className="text-subtle">—</span>,
    },
    {
      key: "contact",
      header: "Contact",
      csvHeader: "Contact person",
      sortValue: (s) => s.contactPerson,
      csvValue: (s) => s.contactPerson,
      render: (s) =>
        s.contactPerson || s.contactPhone ? (
          <div className="text-secondary">
            {s.contactPerson && <div>{s.contactPerson}</div>}
            {s.contactPhone && <div className="text-xs text-subtle">{s.contactPhone}</div>}
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "contactPhone",
      header: "Contact phone",
      csvHeader: "Contact phone",
      defaultHidden: true,
      csvValue: (s) => s.contactPhone,
      render: (s) => s.contactPhone ?? <span className="text-subtle">—</span>,
    },
    {
      key: "contactEmail",
      header: "Contact email",
      csvHeader: "Contact email",
      defaultHidden: true,
      sortValue: (s) => s.contactEmail,
      searchValue: (s) => s.contactEmail,
      csvValue: (s) => s.contactEmail,
      render: (s) => s.contactEmail ?? <span className="text-subtle">—</span>,
    },
    {
      key: "tradeLicenseNumber",
      header: "Trade licence no.",
      csvHeader: "Trade license number",
      defaultHidden: true,
      sortValue: (s) => s.tradeLicenseNumber,
      csvValue: (s) => s.tradeLicenseNumber,
      render: (s) => s.tradeLicenseNumber ?? <span className="text-subtle">—</span>,
    },
    {
      key: "category",
      header: "Category",
      csvHeader: "Category",
      defaultHidden: true,
      sortValue: (s) => s.category,
      csvValue: (s) => s.category,
      render: (s) => s.category ?? <span className="text-subtle">—</span>,
    },
    {
      key: "trn",
      header: "TRN",
      csvHeader: "TRN",
      defaultHidden: true,
      sortValue: (s) => s.trn,
      csvValue: (s) => s.trn,
      render: (s) => s.trn ?? <span className="text-subtle">—</span>,
    },
    {
      key: "employees",
      header: "Employees",
      align: "right",
      sortValue: (s) => s.employeeCount,
      csvValue: (s) => s.employeeCount,
      render: (s) =>
        s.employeeCount > 0 ? (
          <Link href={`/employees?supplier=${s.id}`} className="text-[var(--brand-primary)] hover:underline">
            {s.employeeCount}
          </Link>
        ) : (
          <span className="text-secondary">0</span>
        ),
    },
    {
      key: "licence",
      header: "Trade licence",
      sortValue: (s) => s.licenseExpiry,
      csvValue: (s) => (s.licenseExpiry ? s.licenseExpiry.slice(0, 10) : ""),
      csvHeader: "Trade licence expiry",
      render: (s) =>
        s.licenseExpiry ? (
          <>
            <div className="tabular text-secondary">{fmtShort(s.licenseExpiry)}</div>
            {s.licenseStatus === "expired" && <div className="text-xs font-medium text-[var(--error)]">Expired</div>}
            {s.licenseStatus === "expiring" && <div className="text-xs font-medium text-[var(--warning)]">Expiring soon</div>}
          </>
        ) : (
          <span className="text-subtle">Not set</span>
        ),
    },
    {
      key: "approvals",
      header: "Approvals",
      sortValue: (s) => Object.values(s.approvals).filter((v) => v !== "Approved").length,
      csvValue: (s) => APPROVAL_GATES.map((g) => `${g.label}: ${s.approvals[g.key]}`).join("; "),
      render: (s) => (
        <div className="flex flex-col gap-0.5">
          {APPROVAL_GATES.map((g) => (
            <span key={g.key} className="flex items-center gap-1.5 text-xs text-secondary" title={`${g.label}: ${s.approvals[g.key]}`}>
              <span className={cn("h-1.5 w-1.5 rounded-full", GATE_TONE[s.approvals[g.key]] ?? "bg-[var(--text-subtle)]")} />
              {g.label}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "owed",
      header: "Owed (AED)",
      align: "right",
      sortValue: (s) => s.billBalance,
      csvValue: (s) => Math.round(s.billBalance),
      render: (s) =>
        s.billBalance > 0 ? (
          <>
            <div className="tabular font-medium text-primary">{fmtAed(s.billBalance)}</div>
            {s.billOverdue > 0 && <div className="tabular text-xs font-medium text-[var(--error)]">{fmtAed(s.billOverdue)} overdue</div>}
          </>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      csvHeader: "Status",
      sortValue: (s) => s.status,
      csvValue: (s) => s.status,
      render: (s) => <Badge dot color={s.status === "ACTIVE" ? "green" : "red"}>{s.status}</Badge>,
    },
  ];

  return (
    <DataTable
      rows={suppliers}
      columns={columns}
      tree={{ parentId: (s) => s.parentId }}
      selectable
      searchable
      searchPlaceholder="Search supplier, parent or contact…"
      pageSize={50}
      csvFilename={`suppliers-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{ entityLabel: "suppliers", columns: IMPORT_COLUMNS, importAction: bulkImportSuppliersAction, wizardHref: "/import/new/suppliers" }}
      filters={[
        { key: "status", label: "All statuses", options: [{ value: "ACTIVE", label: "Active" }, { value: "BLACKLISTED", label: "Blacklisted" }], get: (s) => s.status },
        { key: "type", label: "All suppliers", options: [{ value: "primary", label: "Primary suppliers" }, { value: "sub", label: "Subsidiaries" }, { value: "own", label: "Own companies" }], get: (s) => (s.isOwnCompany ? "own" : s.parentId ? "sub" : "primary") },
        { key: "category", label: "All categories", options: categoryOptions, get: (s) => s.category },
        { key: "licence", label: "Any trade licence", options: [{ value: "valid", label: "Valid" }, { value: "expiring", label: "Expiring soon" }, { value: "expired", label: "Expired" }, { value: "not_set", label: "Not recorded" }], get: (s) => s.licenseStatus },
        { key: "approval", label: "Any approvals", options: [{ value: "pending", label: "Something pending" }, { value: "done", label: "All approved" }], get: (s) => (Object.values(s.approvals).every((v) => v === "Approved") ? "done" : "pending") },
        { key: "owed", label: "Any balance", options: [{ value: "owed", label: "We owe them" }, { value: "overdue", label: "Overdue" }], get: (s) => (s.billOverdue > 0 ? "overdue" : s.billBalance > 0 ? "owed" : null) },
      ]}
      getRowClassName={(s) => complianceRowClass(s.licenseStatus) || undefined}
      renderRowActions={(row) => (
        <div className="flex items-center justify-end gap-3">
          {/* Every company insures its own people, so a subsidiary gets its own panel, not the parent's. */}
          <SupplierEmployeePanel supplierId={row.id} supplierName={row.name} supplierBranchId={row.branchId} wizardData={wizardData} />
          <Link href={`/suppliers/${row.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <DeleteButton
            action={deleteSupplierAction}
            hiddenFields={{ supplierId: row.id }}
            confirmMessage={`Delete supplier "${row.name}"?${row.employeeCount > 0 ? ` ${row.employeeCount} employee(s) will be unassigned.` : ""}`}
          />
        </div>
      )}
    />
  );
}
