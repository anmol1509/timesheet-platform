"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { DeleteButton } from "@/components/DeleteButton";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { complianceRowClass, type ComplianceStatus } from "@/lib/compliance";
import { bulkImportClientsAction, deleteClientAction } from "./actions";
import { DeleteClientsButton } from "./delete-clients-button";

type ClientRow = {
  id: string;
  name: string;
  code: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  basicRate: number | null;
  hourlyRate: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  status: string;
  licenseStatus: ComplianceStatus;
  projects: number;
  openDemands: number;
  lpoValue: number;
  lpoBilled: number;
  contractDaysLeft: number | null;
};

const IMPORT_COLUMNS = [
  { key: "name", label: "Company name", required: true, aliases: ["Company", "Client", "Client name", "Name"] },
  { key: "contactPerson", label: "Contact person" },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Contact phone" },
  { key: "trn", label: "TRN" },
  { key: "tradeLicenseNumber", label: "Trade license number" },
];

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const LICENCE_LABEL: Record<ComplianceStatus, string> = { valid: "Valid", expiring: "Expiring soon", expired: "Expired", not_set: "Not recorded" };

export function ClientList({ clients }: { clients: ClientRow[] }) {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  // A column that is empty for the whole list earns no space; it can still be
  // switched on from Columns, and reappears by itself once anything fills it.
  const has = useMemo(
    () => ({
      contactPerson: clients.some((c) => c.contactPerson),
      contactEmail: clients.some((c) => c.contactEmail),
      contactPhone: clients.some((c) => c.contactPhone),
      rates: clients.some((c) => c.basicRate != null || c.hourlyRate != null),
      contract: clients.some((c) => c.contractStart || c.contractEnd),
    }),
    [clients],
  );

  const columns: DataTableColumn<ClientRow>[] = [
    {
      key: "name",
      header: "Company",
      locked: true,
      csvHeader: "Company name",
      sortValue: (c) => c.name,
      searchValue: (c) => `${c.name} ${c.code ?? ""} ${c.contactPerson ?? ""}`,
      csvValue: (c) => c.name,
      render: (c) => (
        <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
          {c.name}
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
      csvHeader: "Code",
      sortValue: (c) => c.code,
      csvValue: (c) => c.code,
      render: (c) => <span className="text-muted">{c.code || "—"}</span>,
    },
    {
      key: "business",
      header: "Business",
      sortValue: (c) => c.projects,
      csvValue: (c) => `${c.projects} projects${c.openDemands ? `, ${c.openDemands} open demands` : ""}`,
      render: (c) => (
        <div className="flex min-w-[150px] flex-col gap-1">
          <span className="text-xs text-secondary">
            <span className="tabular font-medium text-primary">{c.projects}</span> project{c.projects === 1 ? "" : "s"}
            {c.openDemands > 0 && (
              <>
                {" "}· <span className="font-medium text-[var(--warning)]">{c.openDemands} open demand{c.openDemands === 1 ? "" : "s"}</span>
              </>
            )}
          </span>
          {c.lpoValue > 0 ? (
            <ProgressBar value={c.lpoBilled} total={c.lpoValue} label={`${Math.round((c.lpoBilled / c.lpoValue) * 100)}% billed`} />
          ) : (
            <span className="text-xs text-subtle">No active LPO</span>
          )}
        </div>
      ),
    },
    {
      key: "contactPerson",
      header: "Contact person",
      csvHeader: "Contact person",
      defaultHidden: !has.contactPerson,
      sortValue: (c) => c.contactPerson,
      csvValue: (c) => c.contactPerson,
      render: (c) => c.contactPerson || <span className="text-subtle">—</span>,
    },
    {
      key: "contactEmail",
      header: "Contact email",
      csvHeader: "Contact email",
      defaultHidden: !has.contactEmail,
      sortValue: (c) => c.contactEmail,
      csvValue: (c) => c.contactEmail,
      render: (c) => c.contactEmail || <span className="text-subtle">—</span>,
    },
    {
      key: "contactPhone",
      header: "Contact phone",
      csvHeader: "Contact phone",
      defaultHidden: !has.contactPhone,
      sortValue: (c) => c.contactPhone,
      csvValue: (c) => c.contactPhone,
      render: (c) =>
        c.contactPhone ? (
          <a href={`tel:${c.contactPhone}`} className="tabular text-secondary hover:underline">
            {c.contactPhone}
          </a>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "rates",
      header: "Rates (AED)",
      defaultHidden: !has.rates,
      sortValue: (c) => c.basicRate ?? c.hourlyRate,
      csvValue: (c) => [c.basicRate != null ? `Basic ${c.basicRate}` : "", c.hourlyRate != null ? `Hourly ${c.hourlyRate}` : ""].filter(Boolean).join(" · "),
      render: (c) => (
        <div className="text-secondary">
          {c.basicRate != null && <div>Basic: AED {c.basicRate}</div>}
          {c.hourlyRate != null && <div className="text-xs text-subtle">Hourly: AED {c.hourlyRate}</div>}
          {c.basicRate == null && c.hourlyRate == null && <span className="text-subtle">—</span>}
        </div>
      ),
    },
    {
      key: "contract",
      header: "Contract period",
      defaultHidden: !has.contract,
      sortValue: (c) => c.contractEnd,
      csvValue: (c) => (c.contractStart || c.contractEnd ? `${fmtDate(c.contractStart)} – ${fmtDate(c.contractEnd)}` : ""),
      render: (c) => (
        <div className="text-muted">
          {c.contractStart || c.contractEnd ? `${fmtDate(c.contractStart)} – ${fmtDate(c.contractEnd)}` : "—"}
          {c.contractDaysLeft !== null && (
            <div className={`text-xs ${c.contractDaysLeft < 0 ? "font-medium text-[var(--error)]" : c.contractDaysLeft <= 60 ? "font-medium text-[var(--warning)]" : "text-subtle"}`}>
              {c.contractDaysLeft < 0 ? `Ended ${-c.contractDaysLeft}d ago` : `${c.contractDaysLeft}d left`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "licence",
      header: "Trade licence",
      defaultHidden: true,
      sortValue: (c) => c.licenseStatus,
      csvValue: (c) => LICENCE_LABEL[c.licenseStatus],
      render: (c) => LICENCE_LABEL[c.licenseStatus],
    },
    {
      key: "status",
      header: "Status",
      csvHeader: "Status",
      sortValue: (c) => c.status,
      csvValue: (c) => c.status,
      render: (c) => (
        <Badge dot color={c.status === "ACTIVE" ? "green" : "slate"}>
          {c.status}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      rows={clients}
      columns={columns}
      selectable
      searchable
      searchPlaceholder="Search clients by company name, code, or contact person…"
      pageSize={25}
      csvFilename={`clients-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{ entityLabel: "clients", columns: IMPORT_COLUMNS, importAction: bulkImportClientsAction, wizardHref: "/import/new/clients" }}
      initialFilters={status === "active" || status === "inactive" ? { status } : undefined}
      filters={[
        { key: "status", label: "All statuses", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], get: (c) => (c.status === "ACTIVE" ? "active" : "inactive") },
        { key: "licence", label: "Any trade licence", options: (Object.keys(LICENCE_LABEL) as ComplianceStatus[]).map((v) => ({ value: v, label: LICENCE_LABEL[v] })), get: (c) => c.licenseStatus },
        { key: "contract", label: "Any contract", options: [{ value: "ending", label: "Ending within 60 days" }, { value: "ended", label: "Ended" }, { value: "running", label: "Running" }, { value: "none", label: "No contract dates" }], get: (c) => (c.contractDaysLeft === null ? "none" : c.contractDaysLeft < 0 ? "ended" : c.contractDaysLeft <= 60 ? "ending" : "running") },
        { key: "demand", label: "Any demand", options: [{ value: "open", label: "Has open demand" }, { value: "none", label: "No open demand" }], get: (c) => (c.openDemands > 0 ? "open" : "none") },
      ]}
      getRowClassName={(c) => complianceRowClass(c.licenseStatus) || undefined}
      renderBulkActions={(ids, clear) => <DeleteClientsButton ids={ids} onDone={clear} />}
      renderRowActions={(c) => (
        <div className="flex items-center justify-end gap-3">
          <Link href={`/clients/${c.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <DeleteButton
            action={deleteClientAction}
            hiddenFields={{ clientId: c.id }}
            confirmMessage={`Delete client "${c.name}"? Clients with projects or timesheet history can't be deleted — you'll be told which.`}
          />
        </div>
      )}
    />
  );
}
