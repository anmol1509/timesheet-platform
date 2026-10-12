"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { Check, LayoutGrid, Minus, Table2, X } from "lucide-react";
import { type ImportRowResult } from "@/components/CsvImportDialog";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { cn } from "@/lib/cn";
import { STAGES, currentStage, isOverdue, overallStatusLabel, statusKind, type StatusKind } from "@/lib/onboarding";
import { bulkImportCandidatesAction } from "./actions";
import { KanbanBoard } from "./kanban-board";

const IMPORT_COLUMNS = [
  { key: "candidateName", label: "Candidate name", required: true },
  { key: "trade", label: "Trade" },
  { key: "nationality", label: "Nationality" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "passportNumber", label: "Passport number" },
  { key: "emiratesId", label: "Emirates ID" },
  { key: "agency", label: "Agency" },
];

type Candidate = {
  id: string;
  candidateNo: number;
  candidateName: string;
  trade: string | null;
  readyToJoin: boolean;
  joined: boolean;
  updatedAt: Date;
  agency: { name: string } | null;
  offerStatus: string;
  wppStatus: string;
  workPermitPaymentStatus: string;
  entryPermitStatus: string;
  arrivalStatus: string;
  medicalStatus: string;
  tawjeehStatus: string;
  iloeStatus: string;
  contractStatus: string;
  idVisaStatus: string;
};

function StatusIcon({ kind }: { kind: StatusKind }) {
  if (kind === "done") return <Check className="h-4 w-4 text-[var(--success)]" aria-label="Completed" />;
  if (kind === "issue") return <X className="h-4 w-4 text-[var(--error)]" aria-label="Issue" />;
  if (kind === "pending") return <Minus className="h-4 w-4 text-subtle" aria-label="Pending" />;
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--warning)]" aria-label="In progress" />;
}

export function OnboardingTable({ candidates }: { candidates: Candidate[] }) {
  const [view, setView] = useState<"active" | "ready" | "overdue" | "joined" | "all">("active");
  const [layout, setLayout] = useState<"table" | "board">("table");

  async function handleImport(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
    return bulkImportCandidatesAction(rows);
  }

  const inView = useMemo(
    () =>
      candidates.filter((c) => {
        if (view === "active") return !c.joined;
        if (view === "ready") return c.readyToJoin && !c.joined;
        if (view === "overdue") return !c.joined && isOverdue(c, c.updatedAt);
        if (view === "joined") return c.joined;
        return true;
      }),
    [candidates, view],
  );

  const VIEW_OPTIONS: { value: typeof view; label: string }[] = [
    { value: "active", label: "In progress" },
    { value: "ready", label: "Ready to join" },
    { value: "overdue", label: "Overdue" },
    { value: "joined", label: "Joined" },
    { value: "all", label: "All" },
  ];

  const agencyOptions = [...new Set(candidates.map((c) => c.agency?.name).filter((n): n is string => !!n))].sort().map((v) => ({ value: v, label: v }));
  const tradeOptions = [...new Set(candidates.map((c) => c.trade).filter((n): n is string => !!n))].sort().map((v) => ({ value: v, label: v }));
  const stageOptions = STAGES.map((st) => ({ value: st.key, label: st.label }));

  const columns: DataTableColumn<Candidate>[] = [
    {
      key: "candidate",
      header: "Candidate",
      locked: true,
      csvHeader: "Candidate name",
      sortValue: (c) => c.candidateName,
      searchValue: (c) => `${c.candidateName} ${c.trade ?? ""}`,
      csvValue: (c) => c.candidateName,
      render: (c) => (
        <Link href={`/onboarding/${c.id}`} className="group flex items-center gap-2.5">
          <Avatar name={c.candidateName} url={null} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-primary group-hover:underline">{c.candidateName}</span>
            <span className="tabular block text-xs text-subtle">#{String(c.candidateNo).padStart(3, "0")}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "number",
      header: "Candidate no",
      csvHeader: "Candidate no",
      defaultHidden: true,
      sortValue: (c) => c.candidateNo,
      csvValue: (c) => c.candidateNo,
      render: (c) => <span className="tabular text-muted">#{String(c.candidateNo).padStart(3, "0")}</span>,
    },
    {
      key: "agency",
      header: "Agency",
      csvHeader: "Agency",
      sortValue: (c) => c.agency?.name,
      searchValue: (c) => c.agency?.name,
      csvValue: (c) => c.agency?.name,
      render: (c) => <span className="text-secondary">{c.agency?.name ?? "—"}</span>,
    },
    {
      key: "trade",
      header: "Trade",
      csvHeader: "Trade",
      sortValue: (c) => c.trade,
      csvValue: (c) => c.trade,
      render: (c) => <span className="text-secondary">{c.trade ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (c) => overallStatusLabel(c),
      csvValue: (c) => overallStatusLabel(c),
      render: (c) => {
        const overdue = !c.joined && isOverdue(c, c.updatedAt);
        const stage = currentStage(c);
        return (
          <span className={cn("text-xs", overdue ? "font-medium text-[var(--error)]" : "text-secondary")}>
            {overallStatusLabel(c)}
            {overdue && stage ? ` (overdue for ${stage.label})` : ""}
          </span>
        );
      },
    },
    ...STAGES.map(
      (st): DataTableColumn<Candidate> => ({
        key: `stage-${st.key}`,
        header: st.short,
        align: "right",
        sortValue: (c) => c[st.field],
        csvValue: (c) => c[st.field],
        render: (c) => (
          <span className="inline-flex items-center justify-center" title={`${st.label}: ${c[st.field]}`}>
            <StatusIcon kind={statusKind(st, c[st.field])} />
          </span>
        ),
      }),
    ),
    {
      key: "ready",
      header: "Ready",
      align: "right",
      sortValue: (c) => (c.readyToJoin ? 1 : 0),
      csvValue: (c) => (c.readyToJoin ? "Yes" : "No"),
      render: (c) => (c.readyToJoin && !c.joined ? <Check className="ml-auto h-4 w-4 text-[var(--success)]" /> : <Minus className="ml-auto h-4 w-4 text-subtle" />),
    },
    {
      key: "joined",
      header: "Joined",
      align: "right",
      sortValue: (c) => (c.joined ? 1 : 0),
      csvValue: (c) => (c.joined ? "Yes" : "No"),
      render: (c) => (c.joined ? <Check className="ml-auto h-4 w-4 text-[var(--success)]" /> : <Minus className="ml-auto h-4 w-4 text-subtle" />),
    },
  ];

  const controls = (
    <>
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface-subtle p-1">
        {VIEW_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setView(o.value)}
            className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", view === o.value ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary")}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 rounded-lg bg-surface-subtle p-1">
        <button type="button" onClick={() => setLayout("table")} aria-label="Table view" className={cn("rounded-md p-1.5", layout === "table" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary")}>
          <Table2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setLayout("board")} aria-label="Board view" className={cn("rounded-md p-1.5", layout === "board" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary")}>
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  if (layout === "board") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">{controls}</div>
        <KanbanBoard candidates={inView} />
      </div>
    );
  }

  return (
    <DataTable
      rows={inView}
      columns={columns}
      searchable
      searchPlaceholder="Search by candidate name or trade…"
      pageSize={50}
      csvFilename={`onboarding-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{ entityLabel: "candidates", columns: IMPORT_COLUMNS, importAction: handleImport }}
      toolbarExtra={controls}
      filters={[
        { key: "agency", label: "All agencies", options: agencyOptions, get: (c) => c.agency?.name },
        { key: "trade", label: "All trades", options: tradeOptions, get: (c) => c.trade },
        { key: "stage", label: "Any current stage", options: stageOptions, get: (c) => currentStage(c)?.key },
      ]}
      getRowClassName={(c) => (!c.joined && isOverdue(c, c.updatedAt) ? "bg-[var(--error-soft,#fee4e2)]/30" : undefined)}
      emptyState={<p className="px-4 py-8 text-center text-muted">{candidates.length === 0 ? "No candidates yet. Add one to start tracking their onboarding." : "No candidates in this view."}</p>}
    />
  );
}
