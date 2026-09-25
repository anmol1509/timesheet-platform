"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, LayoutGrid, Minus, Table2, X } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { CsvImportDialog, type ImportRowResult } from "@/components/CsvImportDialog";
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [view, setView] = useState<"active" | "ready" | "overdue" | "joined" | "all">("active");
  const [layout, setLayout] = useState<"table" | "board">("table");

  async function handleImport(rows: Record<string, string>[]): Promise<ImportRowResult[]> {
    const results = await bulkImportCandidatesAction(rows);
    router.refresh();
    return results;
  }

  const agencyOptions = useMemo(() => {
    const names = [...new Set(candidates.map((c) => c.agency?.name).filter((n): n is string => !!n))].sort();
    return [{ value: "", label: "All agencies" }, ...names.map((n) => ({ value: n, label: n }))];
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (q && !c.candidateName.toLowerCase().includes(q) && !(c.trade ?? "").toLowerCase().includes(q)) return false;
      if (agencyFilter && c.agency?.name !== agencyFilter) return false;
      if (view === "active") return !c.joined;
      if (view === "ready") return c.readyToJoin && !c.joined;
      if (view === "overdue") return !c.joined && isOverdue(c, c.updatedAt);
      if (view === "joined") return c.joined;
      return true;
    });
  }, [candidates, query, agencyFilter, view]);

  const VIEW_OPTIONS: { value: typeof view; label: string }[] = [
    { value: "active", label: "In progress" },
    { value: "ready", label: "Ready to join" },
    { value: "overdue", label: "Overdue" },
    { value: "joined", label: "Joined" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by candidate name or trade…"
          className="input w-full max-w-xs"
        />
        <div className="w-48">
          <Select name="agencyFilter" value={agencyFilter} onChange={setAgencyFilter} searchable options={agencyOptions} />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-subtle p-1">
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setView(o.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === o.value ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <CsvImportDialog
            entityLabel="candidates"
            columns={IMPORT_COLUMNS}
            importAction={handleImport}
          />
          <div className="flex gap-1 rounded-lg bg-surface-subtle p-1">
            <button
              type="button"
              onClick={() => setLayout("table")}
              aria-label="Table view"
              className={cn("rounded-md p-1.5", layout === "table" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary")}
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayout("board")}
              aria-label="Board view"
              className={cn("rounded-md p-1.5", layout === "board" ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {layout === "board" && <KanbanBoard candidates={filtered} />}

      {layout === "table" && (
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-subtle px-4 py-3">Candidate</th>
              <th className="px-3 py-3">Agency</th>
              <th className="px-3 py-3">Trade</th>
              <th className="px-3 py-3">Status</th>
              {STAGES.map((stage) => (
                <th key={stage.key} className="px-2 py-3 text-center" title={stage.label}>
                  {stage.short}
                </th>
              ))}
              <th className="px-2 py-3 text-center">Ready</th>
              <th className="px-2 py-3 text-center">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((c) => {
              const overdue = !c.joined && isOverdue(c, c.updatedAt);
              const stage = currentStage(c);
              return (
                <tr key={c.id} className={overdue ? "bg-[var(--error-soft,#fee4e2)]/30" : undefined}>
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2.5">
                    <Link href={`/onboarding/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.candidateName}
                    </Link>
                    <span className="ml-1.5 text-xs text-subtle">#{String(c.candidateNo).padStart(3, "0")}</span>
                  </td>
                  <td className="px-3 py-2.5 text-secondary">{c.agency?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-secondary">{c.trade ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-xs", overdue ? "font-medium text-[var(--error)]" : "text-secondary")}>
                      {overallStatusLabel(c)}
                      {overdue && stage ? ` (overdue for ${stage.label})` : ""}
                    </span>
                  </td>
                  {STAGES.map((s) => (
                    <td key={s.key} className="px-2 py-2.5 text-center">
                      <span className="inline-flex items-center justify-center">
                        <StatusIcon kind={statusKind(s, c[s.field])} />
                      </span>
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-center">
                    {c.readyToJoin && !c.joined ? <Check className="mx-auto h-4 w-4 text-[var(--success)]" /> : <Minus className="mx-auto h-4 w-4 text-subtle" />}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    {c.joined ? <Check className="mx-auto h-4 w-4 text-[var(--success)]" /> : <Minus className="mx-auto h-4 w-4 text-subtle" />}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={STAGES.length + 6} className="px-4 py-8 text-center text-muted">
                  {candidates.length === 0 ? "No candidates yet. Add one to start tracking their onboarding." : "No candidates match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
