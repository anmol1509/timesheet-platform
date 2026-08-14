"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  Download,
  Search,
  X,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Checkbox } from "@/components/ui/Checkbox";
import { CsvImportDialog, type ImportColumn, type ImportRowResult } from "@/components/CsvImportDialog";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/lib/useRowSelection";
import { toCsv, downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/cn";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
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
}) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>(null);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key))
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const matchers = columns
      .map((c) => c.searchValue ?? c.csvValue)
      .filter(Boolean) as ((row: T) => string | number | null | undefined)[];
    if (matchers.length === 0) return rows;
    return rows.filter((row) =>
      matchers.some((get) => String(get(row) ?? "").toLowerCase().includes(q))
    );
  }, [rows, query, columns]);

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

  const [page, setPage] = useState(1);
  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;

  // Clamped during render rather than corrected in an effect: filtering can
  // shrink the list out from under the current page, and syncing that back
  // through setState would cost an extra render pass every time.
  const currentPage = Math.min(page, pageCount);

  const visibleRows = pageSize
    ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sorted;

  // Selection spans the whole filtered set, not just the visible page, so
  // "select all" then "export" behaves the way the old per-module tables did.
  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    sorted.map((r) => r.id)
  );

  function exportCsv() {
    if (!csvFilename) return;
    const exportRows =
      selected.size > 0 ? sorted.filter((r) => selected.has(r.id)) : sorted;
    const csv = toCsv(
      exportRows,
      visibleColumns
        .filter(
          (c): c is DataTableColumn<T> & {
            csvValue: NonNullable<DataTableColumn<T>["csvValue"]>;
          } => !!c.csvValue
        )
        .map((c) => ({ header: c.header, value: c.csvValue }))
    );
    downloadCsv(csvFilename, csv);
  }

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null; // third click returns to the server's ordering
    });
  }

  // Nothing at all to show — the empty state stands alone, without a toolbar.
  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

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
    !!importConfig || !!csvFilename || searchable || !!toolbarExtra || hideable.length > 0;
  const cellY = density === "compact" ? "py-1.5" : "py-2.5";
  const colSpan =
    visibleColumns.length + (selectable ? 1 : 0) + (renderRowActions ? 1 : 0);

  const toolbarButton =
    "inline-flex h-8 items-center gap-1.5 rounded-control border border-strong bg-surface px-2.5 text-xs font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary";

  return (
    <div className="space-y-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {toolbarExtra}
          {searchable && (
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-subtle"
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
                className="input h-8 w-full py-0 pr-7 pl-8 text-xs"
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
                onDone={() => router.refresh()}
              />
            )}
            {csvFilename && (
              <button type="button" onClick={exportCsv} className={toolbarButton}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                {selected.size > 0 ? `Export ${selected.size}` : "Export CSV"}
              </button>
            )}
          </div>
        </div>
      )}

      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-[var(--brand-primary-border)] bg-brand-soft px-3 py-2">
          <span className="text-xs font-medium text-[var(--brand-primary)]">
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
      )}

      <div className="card overflow-hidden">
        {/* `overflow-x-auto` makes this a scroll container, so the sticky
            header below sticks to *this* box rather than the viewport — hence
            top-0 and a capped height, instead of offsetting the app header. */}
        <div
          className={cn(
            "overflow-x-auto",
            stickyHeader && "max-h-[calc(100vh-15rem)] overflow-y-auto"
          )}
        >
          <table className="w-full text-sm">
            <thead
              className={cn(
                "border-b border-default bg-surface-subtle text-left text-[11px] font-medium tracking-wide text-muted uppercase",
                stickyHeader && "sticky top-0 z-10"
              )}
            >
              <tr>
                {selectable && (
                  <th scope="col" className="w-10 px-3 py-2">
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
                        "px-3 py-2 font-medium whitespace-nowrap",
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
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={colSpan}
                    className="px-3 py-10 text-center text-sm text-muted"
                  >
                    No rows match &ldquo;{query}&rdquo;.
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
                      : "hover:bg-surface-hover"
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
                    <td className={cn("px-3", cellY)}>
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
                      {c.render(row)}
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
        </div>

        {pageSize && pageCount > 1 ? (
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            totalItems={sorted.length}
            pageSize={pageSize}
          />
        ) : (
          (query || sort) && (
            <div className="flex items-center justify-between gap-3 border-t border-default bg-surface-subtle px-3 py-1.5 text-[11px] text-muted">
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
