"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
  Columns3,
  Download,
  Search,
  X,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { m } from "motion/react";
import { Presence } from "@/components/motion";
import { Checkbox } from "@/components/ui/Checkbox";
import { CsvImportDialog, type ImportColumn, type ImportRowResult } from "@/components/CsvImportDialog";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/lib/useRowSelection";
import { toCsv, downloadCsv } from "@/lib/csv";
import { downloadXlsx } from "@/lib/spreadsheet";
import { Select } from "@/components/ui/Select";
import { ScrollRestore } from "@/components/ScrollRestore";
import { cn } from "@/lib/cn";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** Heading used in the CSV export, when it should differ from the on-screen one (e.g. to match the import template). */
  csvHeader?: string;
  align?: "left" | "right";
  /** `ctx` is only supplied by tables that show rows as a tree (see the `tree` prop). */
  render: (row: T, ctx?: DataTableRowContext) => React.ReactNode;
  // Omit for columns that shouldn't appear in CSV export (e.g. a status Badge).
  csvValue?: (row: T) => string | number | null | undefined;
  /** Sort key. Omit to leave the column unsortable. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  /** Included in the quick-filter match. Defaults to csvValue when present. */
  searchValue?: (row: T) => string | number | null | undefined;
  /** Keep this column out of the column picker (always visible). */
  locked?: boolean;
  /** Hidden until enabled in the column picker. */
  defaultHidden?: boolean;
  /** Let long content wrap instead of staying on one line. */
  wrap?: boolean;
};

export type DataTableImportConfig = {
  entityLabel: string;
  columns: ImportColumn[];
  importAction: (rows: Record<string, string>[]) => Promise<ImportRowResult[]>;
  /** Where the guided import for this kind of data lives, when there is one. */
  wizardHref?: string;
};

/** Where a row sits when the table is shown as a tree of parents and children. */
export type DataTableRowContext = {
  depth: number;
  childCount: number;
  expanded: boolean;
  toggle: () => void;
};

/** A dropdown that narrows the rows: "All …" plus one option per value. */
export type DataTableFilter<T> = {
  key: string;
  /** Shown as the "All …" option, e.g. "All statuses". */
  label: string;
  options: { value: string; label: string }[];
  get: (row: T) => string | null | undefined;
};

type SortState = { key: string; direction: "asc" | "desc" } | null;

// Generalizes the table shell (checkbox selection, CSV import/export, row
// actions) that suppliers/clients/employees each hand-rolled separately.
// Composes the same existing primitives those modules already used —
// Checkbox, useRowSelection, CsvImportDialog, toCsv/downloadCsv — rather
// than replacing them, so this is opt-in per module.
export function DataTable<T extends { id: string }>({
  rows,
  columns,
  rowHref,
  getRowClassName,
  selectable = false,
  csvFilename,
  importConfig,
  renderRowActions,
  renderBulkActions,
  emptyState,
  searchable = false,
  searchPlaceholder = "Filter…",
  density = "default",
  stickyHeader = true,
  toolbarExtra,
  pageSize,
  filters,
  initialFilters,
  tree,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowHref?: (row: T) => string;
  getRowClassName?: (row: T) => string | undefined;
  selectable?: boolean;
  csvFilename?: string;
  importConfig?: DataTableImportConfig;
  renderRowActions?: (row: T) => React.ReactNode;
  /** Rendered in the selection bar; receives the selected ids and a clear fn. */
  renderBulkActions?: (ids: string[], clear: () => void) => React.ReactNode;
  emptyState?: React.ReactNode;
  /** Adds a client-side quick filter over searchValue/csvValue columns. */
  searchable?: boolean;
  searchPlaceholder?: string;
  density?: "default" | "compact";
  stickyHeader?: boolean;
  /** Extra controls (filter chips, tabs) rendered at the toolbar's left. */
  toolbarExtra?: React.ReactNode;
  /** Rows per page. Omit to render every row without pagination. */
  pageSize?: number;
  /** Dropdown filters shown beside the search box. */
  filters?: DataTableFilter<T>[];
  /** Filter values selected on first load, by filter key (e.g. from the URL). */
  initialFilters?: Record<string, string>;
  /** Shows children under their parent (collapsed until opened). Searching or filtering flattens it, so a match is never hidden inside a closed parent. */
  tree?: { parentId: (row: T) => string | null };
}) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>(null);
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(initialFilters ?? {});
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key))
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden]
  );

  const narrowed = useMemo(() => {
    if (!filters || filters.length === 0) return rows;
    return rows.filter((row) => filters.every((f) => !filterValues[f.key] || f.get(row) === filterValues[f.key]));
  }, [rows, filters, filterValues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return narrowed;
    const matchers = columns
      .map((c) => c.searchValue ?? c.csvValue)
      .filter(Boolean) as ((row: T) => string | number | null | undefined)[];
    if (matchers.length === 0) return narrowed;
    return narrowed.filter((row) =>
      matchers.some((get) => String(get(row) ?? "").toLowerCase().includes(q))
    );
  }, [narrowed, query, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return filtered;
    const get = column.sortValue;
    const factor = sort.direction === "asc" ? 1 : -1;
    // Copy first — Array.prototype.sort mutates, and `filtered` can be `rows`.
    return [...filtered].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // Blanks always sort last, whichever direction is active.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      if (av instanceof Date && bv instanceof Date) {
        return (av.getTime() - bv.getTime()) * factor;
      }
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
    });
  }, [filtered, sort, columns]);

  const sortedIds = useMemo(() => new Set(sorted.map((r) => r.id)), [sorted]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const anyFilter = query.trim() !== "" || Object.values(filterValues).some(Boolean);
  const treeActive = !!tree && !anyFilter;

  // Every row's children, when shown as a tree. A row whose parent isn't in
  // the list stays at the top level.
  const childMap = useMemo(() => {
    const map = new Map<string, T[]>();
    if (!tree) return map;
    const ids = new Set(sorted.map((r) => r.id));
    for (const r of sorted) {
      const pid = tree.parentId(r);
      if (pid && ids.has(pid)) map.set(pid, [...(map.get(pid) ?? []), r]);
    }
    return map;
  }, [tree, sorted]);

  const displayRows = useMemo(() => {
    if (!tree || !treeActive) return sorted;
    const ids = new Set(sorted.map((r) => r.id));
    return sorted
      .filter((r) => {
        const pid = tree.parentId(r);
        return !(pid && ids.has(pid));
      })
      .flatMap((top) => [top, ...(expandedIds.has(top.id) ? (childMap.get(top.id) ?? []) : [])]);
  }, [tree, treeActive, sorted, childMap, expandedIds]);

  const [page, setPage] = useState(1);
  const pageCount = pageSize ? Math.max(1, Math.ceil(displayRows.length / pageSize)) : 1;

  // Clamped during render rather than corrected in an effect: filtering can
  // shrink the list out from under the current page, and syncing that back
  // through setState would cost an extra render pass every time.
  const currentPage = Math.min(page, pageCount);

  const visibleRows = pageSize
    ? displayRows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : displayRows;

  // Selection spans the whole filtered set, not just the visible page, so
  // "select all" then "export" behaves the way the old per-module tables did.
  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    sorted.map((r) => r.id)
  );

  function exportCells() {
    const picked = selected.size > 0 ? sorted.filter((r) => selected.has(r.id)) : sorted;
    let exportRows = picked;
    if (tree) {
      // Each child is written right under its parent, so an exported file reads the way it looks.
      const ids = new Set(picked.map((r) => r.id));
      const kids = new Map<string, T[]>();
      const tops: T[] = [];
      for (const r of picked) {
        const pid = tree.parentId(r);
        if (pid && ids.has(pid)) kids.set(pid, [...(kids.get(pid) ?? []), r]);
        else tops.push(r);
      }
      exportRows = tops.flatMap((t) => [t, ...(kids.get(t.id) ?? [])]);
    }
    // What's on screen, plus any hidden column that names its own CSV header
    // (those are the importable fields, so a round trip keeps them).
    const cols = columns
      .filter((c) => visibleColumns.includes(c) || (c.defaultHidden && c.csvHeader))
      .filter(
        (c): c is DataTableColumn<T> & { csvValue: NonNullable<DataTableColumn<T>["csvValue"]> } => !!c.csvValue
      );
    return { exportRows, cols };
  }

  function exportCsv() {
    if (!csvFilename) return;
    const { exportRows, cols } = exportCells();
    downloadCsv(
      csvFilename,
      toCsv(exportRows, cols.map((c) => ({ header: c.csvHeader ?? c.header, value: c.csvValue })))
    );
  }

  function exportExcel() {
    if (!csvFilename) return;
    const { exportRows, cols } = exportCells();
    void downloadXlsx(
      csvFilename.replace(/\.csv$/i, ".xlsx"),
      "Export",
      cols.map((c) => c.csvHeader ?? c.header),
      exportRows.map((r) => cols.map((c) => c.csvValue(r)))
    );
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null; // third click returns to the server's ordering
    });
  }

  // Nothing at all to show — the empty state stands alone, without a toolbar.
  if (rows.length === 0 && emptyState && !importConfig) return <>{emptyState}</>;

  // Row checkboxes carry no visible label, so name them after the row itself —
  // otherwise a screen reader announces 25 identical "checkbox, unchecked".
  const labelColumn = columns.find((c) => c.searchValue ?? c.csvValue);
  const rowLabel = (row: T) => {
    const get = labelColumn?.searchValue ?? labelColumn?.csvValue;
    const value = get ? get(row) : null;
    return value ? `Select ${value}` : "Select row";
  };

  const hideable = columns.filter((c) => !c.locked);
  const showToolbar =
    !!importConfig || !!csvFilename || searchable || !!toolbarExtra || hideable.length > 0 || !!filters?.length;
  const cellY = density === "compact" ? "py-2" : "py-3";
  const colSpan =
    visibleColumns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0);

  const toolbarButton =
    "inline-flex h-9 items-center gap-1.5 rounded-control border border-strong bg-surface px-3 text-[13px] font-medium text-secondary shadow-xs transition hover:border-[#c3c8d4] hover:bg-surface-hover hover:text-primary";

  return (
    <div className="space-y-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {toolbarExtra}
          {searchable && (
            <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="input h-9 w-full py-0 pr-8 pl-9 text-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  aria-label="Clear filter"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xs p-0.5 text-subtle transition hover:text-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {filters?.map((f) => (
            <div key={f.key} className="w-44 shrink-0">
            <Select
              value={filterValues[f.key] ?? ""}
              onChange={(v) => {
                setFilterValues((prev) => ({ ...prev, [f.key]: v }));
                setPage(1);
              }}
              triggerClassName="h-9"
              searchable={f.options.length > 8}
              placeholder={f.label}
              options={[{ value: "", label: f.label }, ...f.options]}
            />
            </div>
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {hideable.length > 0 && (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" className={toolbarButton}>
                    <Columns3 className="h-3.5 w-3.5" aria-hidden />
                    Columns
                    {hidden.size > 0 && (
                      <span className="rounded-xs bg-brand-soft px-1 text-[10px] font-semibold text-[var(--brand-primary)]">
                        {visibleColumns.length}/{columns.length}
                      </span>
                    )}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={6}
                    className="rx-popover z-50 max-h-80 w-52 overflow-y-auto rounded-card border border-default bg-surface p-1 shadow-popover"
                  >
                    {hideable.map((c) => (
                      <label
                        key={c.key}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-secondary transition hover:bg-surface-hover"
                      >
                        <Checkbox
                          checked={!hidden.has(c.key)}
                          onCheckedChange={() =>
                            setHidden((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.key)) next.delete(c.key);
                              else next.add(c.key);
                              return next;
                            })
                          }
                        />
                        {c.header}
                      </label>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}
            {importConfig && (
              <CsvImportDialog
                entityLabel={importConfig.entityLabel}
                columns={importConfig.columns}
                importAction={importConfig.importAction}
                wizardHref={importConfig.wizardHref}
                onDone={() => router.refresh()}
              />
            )}
            {csvFilename && (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button type="button" className={toolbarButton}>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    {selected.size > 0 ? `Export ${selected.size}` : "Export"}
                    <ChevronDown className="h-3 w-3 text-muted" aria-hidden />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    sideOffset={6}
                    className="rx-popover z-50 w-44 rounded-card border border-default bg-surface p-1 shadow-popover"
                  >
                    <Popover.Close asChild>
                      <button type="button" onClick={exportExcel} className="flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-secondary transition hover:bg-surface-hover hover:text-primary">
                        Excel (.xlsx)
                      </button>
                    </Popover.Close>
                    <Popover.Close asChild>
                      <button type="button" onClick={exportCsv} className="flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-secondary transition hover:bg-surface-hover hover:text-primary">
                        CSV (.csv)
                      </button>
                    </Popover.Close>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}
          </div>
        </div>
      )}

      <Presence>
        {selectable && selected.size > 0 && (
          <m.div
            key="bulk-bar"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-card border border-[var(--brand-primary-border)] bg-brand-soft px-4 py-2.5 shadow-xs">
              <span className="tabular text-[13px] font-semibold text-[var(--brand-primary)]">
                {selected.size} selected
              </span>
              {renderBulkActions && (
                <div className="flex flex-wrap items-center gap-2">
                  {renderBulkActions([...selected], clear)}
                </div>
              )}
              <button
                type="button"
                onClick={clear}
                className="ml-auto text-xs font-medium text-[var(--brand-primary)] hover:underline"
              >
                Clear
              </button>
            </div>
          </m.div>
        )}
      </Presence>

      <div className="card overflow-hidden">
        {/* `overflow-x-auto` makes this a scroll container, so the sticky
            header below sticks to *this* box rather than the viewport — hence
            top-0 and a capped height, instead of offsetting the app header. */}
        <ScrollRestore
          id="table"
          className={cn(
            "overflow-x-auto",
            stickyHeader && "max-h-[calc(100vh-15rem)] overflow-y-auto"
          )}
        >
          <table className="w-full text-sm">
            <thead
              className={cn(
                "border-b border-default bg-surface-subtle text-left text-[11px] font-semibold tracking-[0.06em] text-muted uppercase",
                stickyHeader && "sticky top-0 z-10"
              )}
            >
              <tr>
                {selectable && (
                  <th scope="col" className="w-11 px-4 py-2.5">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selected.size > 0 && !allSelected}
                      onCheckedChange={() => toggleAll()}
                      ariaLabel="Select all rows"
                    />
                  </th>
                )}
                {visibleColumns.map((c) => {
                  const sortable = !!c.sortValue;
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={
                        active
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : sortable
                            ? "none"
                            : undefined
                      }
                      className={cn(
                        "px-3 py-2.5 font-semibold whitespace-nowrap",
                        c.align === "right" && "text-right"
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            "group inline-flex items-center gap-1 rounded-xs uppercase transition hover:text-primary",
                            c.align === "right" && "flex-row-reverse",
                            active && "text-primary"
                          )}
                        >
                          {c.header}
                          {active ? (
                            sort.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
                            )
                          ) : (
                            <ChevronsUpDown
                              className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-60"
                              aria-hidden
                            />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                {renderRowActions && (
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sorted.length === 0 && rows.length === 0 && emptyState && (
                <tr>
                  <td colSpan={colSpan}>{emptyState}</td>
                </tr>
              )}
              {sorted.length === 0 && !(rows.length === 0 && emptyState) && (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-10 text-center">
                    <p className="text-sm font-medium text-primary">
                      No rows match &ldquo;{query}&rdquo;
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Check the spelling, or try a shorter search.
                    </p>
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="mt-3 text-xs font-medium text-[var(--brand-primary)] hover:underline"
                    >
                      Clear search
                    </button>
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors",
                    getRowClassName?.(row),
                    rowHref && "cursor-pointer",
                    selected.has(row.id)
                      ? "bg-brand-soft"
                      : "hover:bg-surface-subtle"
                  )}
                  onClick={
                    rowHref
                      ? (e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest("a,button,input,label")) return;
                          router.push(rowHref(row));
                        }
                      : undefined
                  }
                >
                  {selectable && (
                    <td className={cn("px-4", cellY)}>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={() => toggle(row.id)}
                        ariaLabel={rowLabel(row)}
                      />
                    </td>
                  )}
                  {visibleColumns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 text-secondary",
                        cellY,
                        c.align === "right" && "tabular text-right",
                        !c.wrap && "whitespace-nowrap"
                      )}
                    >
                      {c.render(row, tree ? { depth: treeActive && tree.parentId(row) && sortedIds.has(tree.parentId(row)!) ? 1 : 0, childCount: treeActive ? (childMap.get(row.id)?.length ?? 0) : 0, expanded: expandedIds.has(row.id), toggle: () => setExpandedIds((prev) => { const next = new Set(prev); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; }) } : undefined)}
                    </td>
                  ))}
                  {renderRowActions && (
                    <td className={cn("px-3 text-right whitespace-nowrap", cellY)}>
                      {renderRowActions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRestore>

        {pageSize && pageCount > 1 ? (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            totalItems={displayRows.length}
            pageSize={pageSize}
          />
        ) : (
          (query || sort) && (
            <div className="flex items-center justify-between gap-3 border-t border-default bg-surface-subtle px-4 py-2 text-xs text-muted">
              <span>
                Showing {sorted.length} of {rows.length}
              </span>
              {sort && (
                <button
                  type="button"
                  onClick={() => setSort(null)}
                  className="font-medium transition hover:text-secondary"
                >
                  Reset sort
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
