"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, UserPlus, Users, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/RadioGroup";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { bulkImportEmployeesAction } from "./[id]/actions";
import { DeleteEmployeesButton } from "./delete-employees-button";
import { DeactivateEmployeesButton } from "./deactivate-employees-button";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 25;

type EmployeeRow = {
  id: string;
  employeeIdNo: string;
  name: string;
  category: "STAFF" | "SITE_STAFF";
  trade: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  nationality: string | null;
  companyDisplayName: string | null;
  onWork: boolean;
  status: "ACTIVE" | "IDLE" | "UNDER_MOBILISATION" | "ON_SITE" | "ON_VACATION" | "TERMINATED";
  worstStatus: ComplianceStatus;
  complete: boolean;
};

type Filter =
  | "all"
  | "on-work"
  | "bench"
  | "site-staff"
  | "staff"
  | "supplier-labour"
  | "idle"
  | "vacation"
  | "incomplete";

const CATEGORY_FILTER_LABEL: Partial<Record<Filter, string>> = {
  "site-staff": "Site Staff",
  staff: "Staff",
  "supplier-labour": "Supplier Labour",
  idle: "Idle",
  vacation: "On Vacation",
  incomplete: "Incomplete",
};

const SEGMENTED_VALUES: Filter[] = ["all", "on-work", "bench"];

const CATEGORY_LABEL: Record<EmployeeRow["category"], string> = {
  SITE_STAFF: "Site Staff",
  STAFF: "Staff",
};

const STATUS_BADGE: Record<
  ComplianceStatus,
  { label: string; color: "green" | "amber" | "red" | "slate"; rank: number }
> = {
  expired: { label: "Expired", color: "red", rank: 0 },
  expiring: { label: "Expiring soon", color: "amber", rank: 1 },
  not_set: { label: "No records", color: "slate", rank: 2 },
  valid: { label: "Compliant", color: "green", rank: 3 },
};

const IMPORT_COLUMNS = [
  { key: "employeeIdNo", label: "Employee ID No", required: true },
  { key: "name", label: "Full name", required: true },
  { key: "category", label: "Category" },
  { key: "trade", label: "Trade" },
  { key: "nationality", label: "Nationality" },
  { key: "position", label: "Position" },
  { key: "passportNumber", label: "Passport number" },
  { key: "emiratesId", label: "Emirates ID" },
  { key: "mobileNumber", label: "Mobile number" },
];

export function EmployeeList({
  employees,
  initialFilter,
  registeredId,
}: {
  employees: EmployeeRow[];
  initialFilter?: string;
  /** Set right after a registration, to confirm it and point at the new row. */
  registeredId?: string;
}) {
  const router = useRouter();
  const validFilters: Filter[] = [
    "on-work",
    "bench",
    "site-staff",
    "staff",
    "supplier-labour",
    "idle",
    "vacation",
    "incomplete",
  ];
  const [filter, setFilter] = useState<Filter>(
    validFilters.includes(initialFilter as Filter) ? (initialFilter as Filter) : "all"
  );

  const registered = registeredId
    ? employees.find((e) => e.id === registeredId)
    : undefined;

  const rows = useMemo(() => {
    switch (filter) {
      case "on-work":
        return employees.filter((e) => e.onWork);
      case "bench":
        return employees.filter((e) => !e.onWork);
      case "site-staff":
        return employees.filter((e) => !e.companyDisplayName && e.category === "SITE_STAFF");
      case "staff":
        return employees.filter((e) => !e.companyDisplayName && e.category === "STAFF");
      case "supplier-labour":
        return employees.filter((e) => !!e.companyDisplayName);
      case "idle":
        return employees.filter((e) => e.status === "IDLE");
      case "vacation":
        return employees.filter((e) => e.status === "ON_VACATION");
      case "incomplete":
        return employees.filter((e) => !e.complete);
      default:
        return employees;
    }
  }, [employees, filter]);

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: "employeeIdNo",
      header: "ID No",
      locked: true,
      sortValue: (e) => e.employeeIdNo,
      csvValue: (e) => e.employeeIdNo,
      render: (e) => (
        <span className="tabular text-xs text-muted">{e.employeeIdNo}</span>
      ),
    },
    {
      key: "name",
      header: "Employee",
      locked: true,
      sortValue: (e) => e.name,
      csvValue: (e) => e.name,
      render: (e) => (
        <Link href={`/employees/${e.id}`} className="group/name flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[10px] font-semibold text-secondary">
            {e.name
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-primary group-hover/name:underline">
              {e.name}
            </span>
            <span className="block truncate text-[11px] text-subtle">
              {CATEGORY_LABEL[e.category]}
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: "trade",
      header: "Trade",
      sortValue: (e) => e.trade,
      csvValue: (e) => e.trade,
      render: (e) => e.trade || <span className="text-subtle">—</span>,
    },
    {
      key: "passportNumber",
      // Blank for most of the roster today; still available from Columns.
      defaultHidden: true,
      header: "Passport No",
      sortValue: (e) => e.passportNumber,
      csvValue: (e) => e.passportNumber,
      render: (e) =>
        e.passportNumber ? (
          <span className="tabular">{e.passportNumber}</span>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "emiratesId",
      // Blank for most of the roster today; still available from Columns.
      defaultHidden: true,
      header: "Emirates ID",
      sortValue: (e) => e.emiratesId,
      csvValue: (e) => e.emiratesId,
      render: (e) =>
        e.emiratesId ? (
          <span className="tabular">{e.emiratesId}</span>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "nationality",
      header: "Nationality",
      sortValue: (e) => e.nationality,
      csvValue: (e) => e.nationality,
      render: (e) => e.nationality || <span className="text-subtle">—</span>,
    },
    {
      key: "company",
      header: "Company",
      sortValue: (e) => e.companyDisplayName,
      csvValue: (e) => e.companyDisplayName,
      render: (e) => e.companyDisplayName || <span className="text-subtle">—</span>,
    },
    {
      key: "status",
      header: "Compliance",
      // Sorts by severity, not alphabetically — expired first is what matters.
      sortValue: (e) => STATUS_BADGE[e.worstStatus].rank,
      csvValue: (e) => STATUS_BADGE[e.worstStatus].label,
      render: (e) => {
        const badge = STATUS_BADGE[e.worstStatus];
        return (
          <Badge color={badge.color} dot>
            {badge.label}
          </Badge>
        );
      },
    },
    {
      key: "profile",
      header: "Profile",
      sortValue: (e) => (e.complete ? 1 : 0),
      csvValue: (e) => (e.complete ? "Complete" : "Incomplete"),
      render: (e) => (
        <Badge color={e.complete ? "green" : "amber"}>
          {e.complete ? "Complete" : "Incomplete"}
        </Badge>
      ),
    },
  ];

  const activeChip = CATEGORY_FILTER_LABEL[filter];

  return (
    <>
    {registered && (
      <p className="mb-3 flex items-center gap-2 rounded-control border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-2 text-sm text-[var(--success)]">
        <Check className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">{registered.name}</span> registered as{" "}
          <span className="tabular">{registered.employeeIdNo}</span>.
        </span>
        <Link
          href={`/employees/${registered.id}`}
          className="ml-auto shrink-0 font-medium underline"
        >
          Open profile
        </Link>
      </p>
    )}
    <DataTable
      rows={rows}
      columns={columns}
      selectable
      searchable
      searchPlaceholder="Filter by name, ID, trade…"
      pageSize={PAGE_SIZE}
      csvFilename={`employees-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{
        entityLabel: "employees",
        columns: IMPORT_COLUMNS,
        importAction: bulkImportEmployeesAction,
      }}
      getRowClassName={(e) =>
        cn(
          complianceRowClass(e.worstStatus),
          e.id === registeredId && "ring-2 ring-inset ring-[var(--success)]"
        )
      }
      renderRowActions={(e) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/employees/${e.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Link>
          <DeleteEmployeesButton ids={[e.id]} label={e.name} />
        </div>
      )}
      renderBulkActions={(ids, clear) => (
        <div className="flex items-center gap-2">
          <DeactivateEmployeesButton ids={ids} onDone={clear} />
          <DeleteEmployeesButton
            ids={ids}
            label={`${ids.length} employee${ids.length === 1 ? "" : "s"}`}
            variant="bulk"
            onDone={clear}
          />
        </div>
      )}
      toolbarExtra={
        <>
          <SegmentedControl
            value={SEGMENTED_VALUES.includes(filter) ? filter : "all"}
            onChange={(f) => {
              const next = f as Filter;
              setFilter(next);
              router.replace(next === "all" ? "/employees" : `/employees?filter=${next}`);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "on-work", label: "On work" },
              { value: "bench", label: "Bench" },
            ]}
          />
          {activeChip && (
            <span className="inline-flex items-center gap-1 rounded-control bg-brand-soft py-1 pr-1 pl-2.5 text-xs font-medium text-[var(--brand-primary)]">
              {activeChip}
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  router.replace("/employees");
                }}
                aria-label={`Clear ${activeChip} filter`}
                className="rounded-xs p-0.5 transition hover:bg-white/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </>
      }
      emptyState={
        <EmptyState
          icon={Users}
          title={activeChip ? `No ${activeChip.toLowerCase()} employees` : "No employees yet"}
          description={
            activeChip
              ? "Nothing matches this filter right now. Clear it to see the full roster."
              : "Add your first worker to start tracking compliance documents, project deployment, and timesheets. Employees are also created automatically when their ID appears in a timesheet upload."
          }
          action={
            activeChip ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilter("all");
                  router.replace("/employees");
                }}
              >
                Clear filter
              </Button>
            ) : (
              <Button href="/employees/new" size="sm">
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                Add employee
              </Button>
            )
          }
          secondaryAction={
            !activeChip && (
              <Button href="/upload" variant="secondary" size="sm">
                Upload a timesheet
              </Button>
            )
          }
        />
      }
    />
    </>
  );
}
