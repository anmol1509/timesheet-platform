"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, ChevronRight, Download, MoreHorizontal, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/Badge";
import { bulkImportInventoryAction, deleteInventoryItemAction } from "./actions";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { Select } from "@/components/ui/Select";
import { downloadXlsx } from "@/lib/spreadsheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IssueDialog, ReturnDialog, type EmployeeOption, type Holder } from "./issue-dialogs";
import { isLowStock } from "./stock";
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
  holders: Holder[];
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
export function InventoryList({ items, employees }: { items: ItemRow[]; employees: EmployeeOption[] }) {
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
  const [issuing, setIssuing] = useState<string | null>(null);
  const [returning, setReturning] = useState<string | null>(null);

  const categoryOptions = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort().map((v) => ({ value: v, label: v }));
  const shown = items.filter((i) => {
    const q = query.trim().toLowerCase();
    if (q && !`${i.name} ${i.category ?? ""} ${i.variants.map((v) => `${v.name} ${v.sku ?? ""}`).join(" ")}`.toLowerCase().includes(q)) return false;
    if (category && i.category !== category) return false;
    const left = i.inStock - i.issued;
    if (stockFilter === "out" && !(left <= 0)) return false;
    if (stockFilter === "in" && !(left > 0)) return false;
    if (stockFilter === "low" && !(left <= 0 || isLowStock(i.inStock, i.issued))) return false;
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
        <div className="flex flex-wrap gap-1.5">
          {([["", "All"], ["low", "Low / out"], ["issued", "Issued out"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setStockFilter(key)} className={cn("rounded-control border px-3 py-1.5 text-xs font-medium transition", stockFilter === key ? "border-[var(--brand-primary)] bg-brand-soft text-[var(--brand-primary)]" : "border-default bg-surface text-secondary hover:bg-surface-hover")}>
              {label} ({items.filter((i) => key === "" || (key === "low" ? i.inStock - i.issued <= 0 || isLowStock(i.inStock, i.issued) : i.activeAssignments > 0 || i.issued > 0)).length})
            </button>
          ))}
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
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3 text-right">Issued</th>
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
                    <td className="px-4 py-3">
                      <span className="tabular"><b className={cn(left < 0 ? "text-[var(--error)]" : "text-primary")}>{Math.max(left, 0)}</b> <span className="text-muted">of {i.inStock}</span></span>
                      <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-surface-sunken">
                        <span className={cn("block h-full rounded-full", left <= 0 ? "bg-[var(--error)]" : isLowStock(i.inStock, i.issued) ? "bg-[var(--warning)]" : "bg-[var(--success)]")} style={{ width: `${i.inStock ? Math.max(0, (left / i.inStock) * 100) : 0}%` }} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular text-secondary">{i.issued}</td>
                    <td className="px-4 py-3">
                      {i.inStock === 0 || left <= 0 ? <Badge color="red">{i.inStock === 0 ? "No stock" : "Out of stock"}</Badge> : isLowStock(i.inStock, i.issued) ? <Badge color="amber">Low stock</Badge> : <Badge color="green">In stock</Badge>}
                      {i.activeAssignments > 0 && <span className="ml-2 text-xs text-subtle">{i.assignedQuantity} on {i.activeAssignments} project{i.activeAssignments === 1 ? "" : "s"}</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        {i.holders.length > 0 && <button type="button" onClick={() => setReturning(i.id)} className="btn btn-secondary btn-sm">Return</button>}
                        {left > 0 ? (
                          <button type="button" onClick={() => setIssuing(i.id)} className="btn btn-secondary btn-sm">Issue</button>
                        ) : (
                          <Link href={`/inventory/${i.id}`} className="btn btn-secondary btn-sm">Add stock</Link>
                        )}
                        <RowMenu item={i} />
                      </span>
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
                        <td className={cn("px-4 py-2 tabular font-medium", v.available <= 0 ? "text-[var(--error)]" : "text-primary")}>
                          {v.available} <span className="font-normal text-muted">of {v.stock}</span>
                        </td>
                        <td className="px-4 py-2 text-right tabular text-secondary">{v.issued}</td>
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
            {items.length === 0 ? "No inventory items yet. Add one with the button above, or import a list." : "No items match."}
          </p>
        )}
      </div>
      <IssueDialog open={!!issuing} onClose={() => setIssuing(null)} item={items.find((i) => i.id === issuing) ?? null} employees={employees} />
      <ReturnDialog open={!!returning} onClose={() => setReturning(null)} item={items.find((i) => i.id === returning) ?? null} />
    </div>
  );
}

/** Open or delete, behind one "⋯" so the row stays quiet. */
function RowMenu({ item }: { item: ItemRow }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const entry = "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-secondary hover:bg-surface-hover hover:text-primary";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Actions for ${item.name}`} className="rounded-md p-1.5 text-subtle hover:bg-surface-sunken hover:text-primary"><MoreHorizontal className="h-4 w-4" aria-hidden /></button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="rx-popover z-50 w-40 rounded-control border border-default bg-surface p-1 shadow-popover">
          <Link href={`/inventory/${item.id}`} className={entry} onClick={() => setOpen(false)}>Open item</Link>
          <ConfirmDialog
            title="Delete this item?"
            description={`Delete "${item.name}"?${item.activeAssignments > 0 ? " It is still assigned to a project." : ""}`}
            confirmLabel="Delete"
            onConfirm={async () => {
              const form = new FormData();
              form.append("itemId", item.id);
              setOpen(false);
              await deleteInventoryItemAction(form);
              router.refresh();
            }}
            trigger={(openConfirm) => <button type="button" className={cn(entry, "text-[var(--error)] hover:text-[var(--error)]")} onClick={openConfirm}><Trash2 className="h-4 w-4" aria-hidden />Delete</button>}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
