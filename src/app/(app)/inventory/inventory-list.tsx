"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { deleteInventoryItemAction } from "./actions";
import { DeleteButton } from "@/components/DeleteButton";

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

/** Per-variant stock/issued/available, tucked behind a `<details>` toggle so
 * the table stays scannable at item level but the breakdown is one click away. */
function VariantDropdown({ variants }: { variants: VariantRow[] }) {
  if (variants.length === 0) return <span className="text-xs text-subtle">No variants</span>;
  return (
    <details className="group relative" onClick={(e) => e.stopPropagation()}>
      <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-[var(--brand-primary)]">
        {variants.length} variant{variants.length === 1 ? "" : "s"}
        <ChevronDown className="h-3 w-3 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute top-full right-0 z-10 mt-1 w-56 rounded-lg border border-default bg-surface p-2 shadow-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-subtle">
              <th className="pb-1 font-medium">Variant</th>
              <th className="pb-1 text-right font-medium">Stock</th>
              <th className="pb-1 text-right font-medium">Avail.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {variants.map((v) => (
              <tr key={v.id}>
                <td className="py-1 pr-2 text-secondary">{v.name}</td>
                <td className="py-1 text-right tabular text-secondary">{v.stock}</td>
                <td className={`py-1 text-right tabular font-medium ${v.available <= 0 ? "text-[var(--error)]" : "text-primary"}`}>{v.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function InventoryList({ items }: { items: ItemRow[] }) {
  const columns: DataTableColumn<ItemRow>[] = [
    {
      key: "name",
      header: "Item",
      render: (i) => (
        <Link href={`/inventory/${i.id}`} className="font-medium text-primary hover:underline">
          {i.name}
        </Link>
      ),
      csvValue: (i) => i.name,
    },
    {
      key: "category",
      header: "Category",
      render: (i) => i.category || "—",
      csvValue: (i) => i.category,
    },
    {
      key: "inStock",
      header: "Qty in stock",
      render: (i) => <span className="tabular">{i.inStock}</span>,
      csvValue: (i) => i.inStock,
      sortValue: (i) => i.inStock,
    },
    {
      key: "issued",
      header: "Issued",
      render: (i) => <span className="tabular text-secondary">{i.issued}</span>,
      csvValue: (i) => i.issued,
      sortValue: (i) => i.issued,
    },
    {
      key: "available",
      header: "Available",
      render: (i) => {
        const left = i.inStock - i.issued;
        return <span className={`tabular font-medium ${left < 0 ? "text-[var(--error)]" : left === 0 && i.inStock > 0 ? "text-[var(--warning)]" : "text-primary"}`}>{left}</span>;
      },
      csvValue: (i) => i.inStock - i.issued,
      sortValue: (i) => i.inStock - i.issued,
    },
    {
      key: "variants",
      header: "Variants",
      render: (i) => <VariantDropdown variants={i.variants} />,
      csvValue: (i) => i.variants.map((v) => `${v.name}: ${v.available}/${v.stock}`).join("; "),
    },
    {
      key: "status",
      header: "Status",
      render: (i) =>
        i.activeAssignments > 0 ? (
          <Badge color="amber">
            In use ({i.assignedQuantity} on {i.activeAssignments} project
            {i.activeAssignments === 1 ? "" : "s"})
          </Badge>
        ) : (
          <Badge color="green">Available</Badge>
        ),
      csvValue: (i) => (i.activeAssignments > 0 ? "In use" : "Available"),
    },
  ];

  return (
    <DataTable
      rows={items}
      columns={columns}
      rowHref={(i) => `/inventory/${i.id}`}
      csvFilename={`inventory-${new Date().toISOString().slice(0, 10)}.csv`}
      renderRowActions={(i) => (
        <DeleteButton
          action={deleteInventoryItemAction}
          hiddenFields={{ itemId: i.id }}
          confirmMessage={`Delete "${i.name}"?${
            i.activeAssignments > 0 ? " It is still assigned to a project." : ""
          }`}
        />
      )}
    />
  );
}
