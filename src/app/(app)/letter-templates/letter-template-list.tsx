"use client";

import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteLetterTemplateAction } from "./actions";

type TemplateRow = { id: string; name: string; category: string | null };

export function LetterTemplateList({ templates }: { templates: TemplateRow[] }) {
  const columns: DataTableColumn<TemplateRow>[] = [
    { key: "name", header: "Name", render: (t) => t.name, csvValue: (t) => t.name },
    {
      key: "category",
      header: "Category",
      render: (t) => t.category || "—",
      csvValue: (t) => t.category,
    },
  ];

  return (
    <DataTable
      rows={templates}
      columns={columns}
      renderRowActions={(t) => (
        <DeleteButton
          action={deleteLetterTemplateAction}
          hiddenFields={{ letterTemplateId: t.id }}
          confirmMessage={`Delete letter template "${t.name}"?`}
        />
      )}
    />
  );
}
