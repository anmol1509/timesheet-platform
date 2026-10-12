"use client";

import { useMemo, useState, useTransition } from "react";
import { DeleteButton } from "@/components/DeleteButton";
import { TrendingUp } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { bulkImportTradesAction, toggleTrendingAction, deleteSkillAction, updateSkillAction } from "./actions";

type TradeRow = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  trending: boolean;
  employeeCount: number;
  popularity: number;
  idle: number;
  openDemand: number;
  /** In the catalogue every branch shares, rather than one this branch added. */
  shared: boolean;
  /** Whether the current user may rename, retag or delete it. */
  editable: boolean;
};

const IMPORT_COLUMNS = [
  { key: "name", label: "Trade name", required: true, aliases: ["Trade", "Name", "Skill"] },
  { key: "code", label: "Code", aliases: ["Short code"] },
  { key: "category", label: "Category" },
  { key: "trending", label: "Trending" },
];

export function TradeTable({ trades }: { trades: TradeRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(s: TradeRow) {
    setEditingId(s.id);
    setDraftName(s.name);
    setDraftCategory(s.category || "");
  }

  function saveEdit() {
    if (!editingId) return;
    const formData = new FormData();
    formData.set("skillId", editingId);
    formData.set("name", draftName);
    formData.set("category", draftCategory);
    startTransition(async () => {
      await updateSkillAction(formData);
      setEditingId(null);
    });
  }

  const categoryOptions = useMemo(
    () => [...new Set(trades.map((t) => t.category).filter((c): c is string => !!c))].sort().map((v) => ({ value: v, label: v })),
    [trades],
  );

  const columns: DataTableColumn<TradeRow>[] = [
    {
      key: "name",
      header: "Trade name",
      locked: true,
      csvHeader: "Trade name",
      sortValue: (s) => s.name,
      csvValue: (s) => s.name,
      render: (s) =>
        editingId === s.id ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} autoFocus className="input px-2 py-1" />
            <input value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} placeholder="Category" className="input px-2 py-1" />
            <button type="button" disabled={pending} onClick={saveEdit} className="text-xs font-medium text-[var(--success)] hover:underline disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="text-xs font-medium text-subtle hover:underline">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 font-medium text-primary">
            {s.name}
            {s.shared && (
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-subtle" title="Part of the standard catalogue shared by every company">
                Standard
              </span>
            )}
            {s.editable ? (
              <form action={toggleTrendingAction}>
                <input type="hidden" name="skillId" value={s.id} />
                <input type="hidden" name="trending" value={String(s.trending)} />
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s.trending ? "bg-[var(--info-soft)] text-[var(--brand-primary)]" : "bg-surface-subtle text-subtle hover:text-muted"
                  }`}
                  title="Toggle trending"
                >
                  <TrendingUp className="h-3 w-3" /> Trending
                </button>
              </form>
            ) : s.trending ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--info-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--brand-primary)]">
                <TrendingUp className="h-3 w-3" /> Trending
              </span>
            ) : null}
            {s.editable && (
              <button type="button" onClick={() => startEdit(s)} className="text-xs font-medium text-subtle hover:text-secondary hover:underline">
                Edit
              </button>
            )}
          </div>
        ),
    },
    {
      key: "code",
      header: "Code",
      csvHeader: "Code",
      defaultHidden: true,
      sortValue: (s) => s.code,
      searchValue: (s) => s.code,
      csvValue: (s) => s.code,
      render: (s) => (s.code ? <span className="tabular text-muted">{s.code}</span> : <span className="text-subtle">—</span>),
    },
    {
      key: "category",
      header: "Category",
      csvHeader: "Category",
      sortValue: (s) => s.category,
      searchValue: (s) => s.category,
      csvValue: (s) => s.category,
      render: (s) =>
        editingId === s.id ? null : s.category ? (
          <span className="rounded-full bg-surface-sunken px-2 py-1 text-xs text-secondary">{s.category}</span>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "trending",
      header: "Trending",
      csvHeader: "Trending",
      defaultHidden: true,
      sortValue: (s) => (s.trending ? 1 : 0),
      csvValue: (s) => (s.trending ? "Yes" : "No"),
      render: (s) => (s.trending ? "Yes" : <span className="text-subtle">No</span>),
    },
    {
      key: "employees",
      header: "Employee count",
      align: "right",
      sortValue: (s) => s.employeeCount,
      csvValue: (s) => s.employeeCount,
      render: (s) => <span className="tabular text-secondary">{s.employeeCount}</span>,
    },
    {
      key: "idle",
      header: "On bench",
      align: "right",
      sortValue: (s) => s.idle,
      csvValue: (s) => s.idle,
      render: (s) => <span className="tabular text-secondary">{s.idle || <span className="text-subtle">—</span>}</span>,
    },
    {
      key: "demand",
      header: "Open demand",
      sortValue: (s) => s.openDemand,
      csvValue: (s) => s.openDemand,
      render: (s) =>
        s.openDemand === 0 ? (
          <span className="text-xs text-subtle">—</span>
        ) : s.idle >= s.openDemand ? (
          <span className="text-xs font-medium text-[var(--success)]">{s.openDemand} needed · bench covers it</span>
        ) : (
          <span className="text-xs font-medium text-[var(--warning)]">{s.openDemand} needed · short by {s.openDemand - s.idle}</span>
        ),
    },
    {
      key: "share",
      header: "Share of workforce",
      sortValue: (s) => s.popularity,
      render: (s) =>
        s.employeeCount === 0 ? (
          <span className="text-xs text-subtle">Unused</span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
              {/* Floor at a visible sliver so a real but small share doesn't render as an empty bar. */}
              <div className="h-full rounded-full bg-[var(--brand-primary)]" style={{ width: `${Math.max(4, Math.min(100, s.popularity))}%` }} />
            </div>
            <span className="tabular text-xs text-muted">{s.popularity < 1 ? "<1" : s.popularity.toFixed(0)}%</span>
          </div>
        ),
    },
  ];

  return (
    <DataTable
      rows={trades}
      columns={columns}
      searchable
      searchPlaceholder="Search trades…"
      pageSize={50}
      emptyState={<p className="px-4 py-10 text-center text-sm text-muted">No trades tracked yet. Add one above, import a list, or tag skills from an employee&rsquo;s profile.</p>}
      csvFilename={`trades-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{ entityLabel: "trades", columns: IMPORT_COLUMNS, importAction: bulkImportTradesAction }}
      filters={[
        { key: "category", label: "All categories", options: categoryOptions, get: (s) => s.category },
        { key: "source", label: "All trades", options: [{ value: "standard", label: "Standard catalogue" }, { value: "own", label: "Added by us" }], get: (s) => (s.shared ? "standard" : "own") },
        { key: "use", label: "Any usage", options: [{ value: "used", label: "In use" }, { value: "unused", label: "Unused" }], get: (s) => (s.employeeCount > 0 ? "used" : "unused") },
        { key: "bench", label: "Any bench", options: [{ value: "yes", label: "People on bench" }, { value: "no", label: "None on bench" }], get: (s) => (s.idle > 0 ? "yes" : "no") },
      ]}
      renderRowActions={(s) =>
        s.editable ? (
          <DeleteButton
            action={deleteSkillAction}
            hiddenFields={{ skillId: s.id }}
            confirmMessage={`Delete the "${s.name}" trade? It will be removed from ${s.employeeCount} employee(s).`}
          />
        ) : null
      }
    />
  );
}
