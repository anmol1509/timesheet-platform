"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { Badge } from "@/components/Badge";
import { bulkImportInventoryAction, deleteInventoryItemAction } from "./actions";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { Select } from "@/components/ui/Select";
import { downloadXlsx } from "@/lib/spreadsheet";
import { DeleteButton } from "@/components/DeleteButton";
import { toCsv, downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/cn";

type VariantRow = { id: string; name: string; sku: string | null; stock: number; issued: number; available: number };

type ItemRow = {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  activeAssignments: number;
  assignedQuantity: number;
  inStock: number;
  issued: number;
  variants: VariantRow[];
};

const IMPORT_COLUMNS = [
  { key: "item", label: "Item", required: true, aliases: ["Item name", "Name"] },
  { key: "category", label: "Category" },
  { key: "variant", label: "Variant", aliases: ["Size", "Colour", "Color"] },
  { key: "sku", label: "SKU", aliases: ["Code"] },
  { key: "stock", label: "Stock", aliases: ["Qty", "Quantity", "Qty in stock"] },
  { key: "notes", label: "Notes" },
];

/** Same expand-in-place pattern as the Suppliers list uses for subsidiaries —
 * a chevron toggles variant rows into the same table, indented, rather than
 * a floating panel. */
export function InventoryList({ items }: { items: ItemRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stockFilter, setStockFilter] = useState("");

  const categoryOptions = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort().map((v) => ({ value: v, label: v }));
  const shown = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (q && !`${i.name} ${i.category ?? ""} ${i.variants.map((v) => `${v.name} ${v.sku ?? ""}`).join(" ")}`.toLowerCase().includes(q)) return false;
    if (category && i.category !== category) return false;
    const left = i.inStock - i.issued;
    if (stockFilter === "out" && !(left <= 0)) return false;
    if (stockFilter === "in" && !(left > 0)) return false;
    if (stockFilter === "issued" && !(i.activeAssignments > 0 || i.issued > 0)) return false;
    return true;
  });

  // One row per variant (or one for an item with none), in the same columns the import reads.
  function exportRows() {
    const headers = ["Item", "Category", "Variant", "SKU", "Stock", "Issued", "Available", "Notes"];
    const rows = shown.flatMap((i) =>
      i.variants.length === 0
        ? [[i.name, i.category, "", "", i.inStock, i.issued, i.inStock - i.issued, i.notes]]
        : i.variants.map((v) => [i.name, i.category, v.name, v.sku, v.stock, v.issued, v.available, i.notes]),
    );
    return { headers, rows };
  }
  function exportCsv() {
    const { headers, rows } = exportRows();
    const csv = toCsv(rows, headers.map((h, idx) => ({ header: h, value: (r: (string | number | null)[]) => r[idx] })));
    downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }
  function exportExcel() {
    const { headers, rows } = exportRows();
    void downloadXlsx(`inventory-${new Date().toISOString().slice(0, 10)}.xlsx`, "Inventory", headers, rows);
  }

  const toolbarButton =
    "inline-flex h-9 items-center gap-1.5 rounded-control border border-strong bg-surface px-3 text-[13px] font-medium text-secondary shadow-xs transition hover:bg-surface-hover hover:text-primary";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items, variants or SKU…"
            aria-label="Search inventory"
            className="input h-9 w-full py-0 pr-3 pl-9 text-sm"
          />
        </div>
        <div className="w-44 shrink-0">
          <Select value={category} onChange={setCategory} triggerClassName="h-9" placeholder="All categories" options={[{ value: "", label: "All categories" }, ...categoryOptions]} />
        </div>
        <div className="w-44 shrink-0">
          <Select
            value={stockFilter}
            onChange={setStockFilter}
            triggerClassName="h-9"
            placeholder="Any stock"
            searchable={false}
            options={[{ value: "", label: "Any stock" }, { value: "in", label: "In stock" }, { value: "out", label: "Out of stock" }, { value: "issued", label: "Issued out" }]}
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <CsvImportDialog entityLabel="inventory" columns={IMPORT_COLUMNS} importAction={bulkImportInventoryAction} onDone={() => router.refresh()} />
          <Popover.Root>
            <Popover.Trigger asChild>
              <button type="button" className={toolbarButton}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export
                <ChevronDown className="h-3 w-3 text-muted" aria-hidden />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={6} className="rx-popover z-50 w-44 rounded-card border border-default bg-surface p-1 shadow-popover">
                <Popover.Close asChild>
                  <button type="button" onClick={exportExcel} className="flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-secondary transition hover:bg-surface-hover hover:text-primary">Excel (.xlsx)</button>
                </Popover.Close>
                <Popover.Close asChild>
                  <button type="button" onClick={exportCsv} className="flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-[13px] text-secondary transition hover:bg-surface-hover hover:text-primary">CSV (.csv)</button>
                </Popover.Close>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Qty in stock</th>
              <th className="px-4 py-3 text-right">Issued</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {shown.map((i) => {
              const isOpen = expanded.has(i.id);
              const left = i.inStock - i.issued;
              const hasVariants = i.variants.length > 0;
              return (
                <Fragment key={i.id}>
                  <tr>
                    <td className="px-4 py-3 font-medium text-primary">
                      <span className="flex items-center gap-1.5">
                        {hasVariants ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(i.id)}
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? "Hide" : "Show"} ${i.variants.length} variants of ${i.name}`}
                            className="rounded-sm p-0.5 text-subtle transition hover:bg-surface-hover hover:text-secondary"
                          >
                            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
                          </button>
                        ) : (
                          <span className="w-[18px]" />
                        )}
                        <Link href={`/inventory/${i.id}`} className="hover:underline">
                          {i.name}
                        </Link>
                        {hasVariants && (
                          <span className="text-xs font-normal text-subtle">
                            {i.variants.length} variant{i.variants.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-secondary">{i.category || "—"}</td>
                    <td className="px-4 py-3 text-right tabular">{i.inStock}</td>
                    <td className="px-4 py-3 text-right tabular text-secondary">{i.issued}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular font-medium",
                        left < 0 ? "text-[var(--error)]" : left === 0 && i.inStock > 0 ? "text-[var(--warning)]" : "text-primary"
                      )}
                    >
                      {left}
                    </td>
                    <td className="px-4 py-3">
                      {i.activeAssignments > 0 ? (
                        <Badge color="amber">
                          In use ({i.assignedQuantity} on {i.activeAssignments} project
                          {i.activeAssignments === 1 ? "" : "s"})
                        </Badge>
                      ) : (
                        <Badge color="green">Available</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <DeleteButton
                        action={deleteInventoryItemAction}
                        hiddenFields={{ itemId: i.id }}
                        confirmMessage={`Delete "${i.name}"?${i.activeAssignments > 0 ? " It is still assigned to a project." : ""}`}
                      />
                    </td>
                  </tr>
                  {isOpen &&
                    i.variants.map((v) => (
                      <tr key={v.id} className="bg-surface-subtle/60">
                        <td className="py-2 pr-4 pl-11 text-secondary">
                          {v.name}
                          {v.sku && <span className="ml-1.5 text-xs text-subtle">{v.sku}</span>}
                        </td>
                        <td className="px-4 py-2" />
                        <td className="px-4 py-2 text-right tabular text-secondary">{v.stock}</td>
                        <td className="px-4 py-2 text-right tabular text-secondary">{v.issued}</td>
                        <td className={cn("px-4 py-2 text-right tabular font-medium", v.available <= 0 ? "text-[var(--error)]" : "text-primary")}>
                          {v.available}
                        </td>
                        <td className="px-4 py-2" colSpan={2} />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {items.length === 0 ? "No inventory items yet. Add one above, or import a list." : "No items match."}
          </p>
        )}
      </div>
    </div>
  );
}
