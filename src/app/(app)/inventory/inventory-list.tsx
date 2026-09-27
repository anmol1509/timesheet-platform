"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronRight, Download } from "lucide-react";
import { Badge } from "@/components/Badge";
import { deleteInventoryItemAction } from "./actions";
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

/** Same expand-in-place pattern as the Suppliers list uses for subsidiaries —
 * a chevron toggles variant rows into the same table, indented, rather than
 * a floating panel. */
export function InventoryList({ items }: { items: ItemRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const csv = toCsv(items, [
      { header: "Item", value: (i) => i.name },
      { header: "Category", value: (i) => i.category },
      { header: "Qty in stock", value: (i) => i.inStock },
      { header: "Issued", value: (i) => i.issued },
      { header: "Available", value: (i) => i.inStock - i.issued },
      { header: "Variants", value: (i) => i.variants.map((v) => `${v.name}: ${v.available}/${v.stock}`).join("; ") },
      { header: "Status", value: (i) => (i.activeAssignments > 0 ? "In use" : "Available") },
    ]);
    downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={exportCsv} className="btn btn-secondary">
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export CSV
        </button>
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
            {items.map((i) => {
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
      </div>
    </div>
  );
}
