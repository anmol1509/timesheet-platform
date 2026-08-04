"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { CsvImportDialog, type ImportColumn, type ImportRowResult } from "@/components/CsvImportDialog";
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
};

export type DataTableImportConfig = {
  entityLabel: string;
  columns: ImportColumn[];
  importAction: (rows: Record<string, string>[]) => Promise<ImportRowResult[]>;
};

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
  emptyState,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowHref?: (row: T) => string;
  getRowClassName?: (row: T) => string | undefined;
  selectable?: boolean;
  csvFilename?: string;
  importConfig?: DataTableImportConfig;
  renderRowActions?: (row: T) => React.ReactNode;
  emptyState?: React.ReactNode;
}) {
  const router = useRouter();
  const { selected, toggle, toggleAll, allSelected, clear } = useRowSelection(
    rows.map((r) => r.id)
  );

  function exportCsv() {
    if (!csvFilename) return;
    const exportRows = selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows;
    const csv = toCsv(
      exportRows,
      columns
        .filter((c): c is DataTableColumn<T> & { csvValue: NonNullable<DataTableColumn<T>["csvValue"]> } => !!c.csvValue)
        .map((c) => ({ header: c.header, value: c.csvValue }))
    );
    downloadCsv(csvFilename, csv);
  }

  if (rows.length === 0 && emptyState) return <>{emptyState}</>;

  const showToolbar = !!importConfig || !!csvFilename;

  return (
    <div className="space-y-4">
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {importConfig && (
            <CsvImportDialog
              entityLabel={importConfig.entityLabel}
              columns={importConfig.columns}
              importAction={importConfig.importAction}
              onDone={() => router.refresh()}
            />
          )}
          {csvFilename && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              {selected.size > 0 ? `Export selected (${selected.size})` : "Export CSV"}
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn("px-4 py-3", c.align === "right" && "text-right")}
                >
                  {c.header}
                </th>
              ))}
              {renderRowActions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(getRowClassName?.(row), rowHref && "cursor-pointer")}
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
                  <td className="px-4 py-3">
                    <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggle(row.id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn("px-4 py-3", c.align === "right" && "text-right")}
                  >
                    {c.render(row)}
                  </td>
                ))}
                {renderRowActions && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {renderRowActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectable && selected.size > 0 && (
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-slate-500 hover:underline"
        >
          Clear selection ({selected.size})
        </button>
      )}
    </div>
  );
}
