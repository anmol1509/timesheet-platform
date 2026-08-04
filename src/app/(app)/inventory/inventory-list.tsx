"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { deleteInventoryItemAction } from "./actions";
import { DeleteButton } from "@/components/DeleteButton";

type ItemRow = {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  activeAssignments: number;
  assignedQuantity: number;
};

export function InventoryList({ items }: { items: ItemRow[] }) {
  const columns: DataTableColumn<ItemRow>[] = [
    {
      key: "name",
      header: "Item",
      render: (i) => (
        <Link href={`/inventory/${i.id}`} className="font-medium text-slate-900 hover:underline">
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
