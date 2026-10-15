"use client";

import Link from "next/link";
import { DeleteButton } from "@/components/DeleteButton";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { bulkImportSitesAction, deleteSiteAction } from "./actions";

export type SiteRow = {
  id: string;
  name: string;
  address: string | null;
  projectId: string;
  projectCode: string;
  projectName: string;
  clientName: string | null;
  workers: number;
  timesheetRows: number;
};

const IMPORT_COLUMNS = [
  { key: "project", label: "Project", required: true, aliases: ["Project code", "Project name"] },
  { key: "name", label: "Site name", required: true, aliases: ["Site", "Name"] },
  { key: "address", label: "Address", aliases: ["Location"] },
];

export function SiteTable({ sites }: { sites: SiteRow[] }) {
  const projectOptions = [...new Map(sites.map((s) => [s.projectId, `${s.projectCode} — ${s.projectName}`])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const clientOptions = [...new Set(sites.map((s) => s.clientName).filter((c): c is string => !!c))].sort().map((v) => ({ value: v, label: v }));

  const columns: DataTableColumn<SiteRow>[] = [
    {
      key: "name",
      header: "Site",
      locked: true,
      csvHeader: "Site name",
      sortValue: (s) => s.name,
      csvValue: (s) => s.name,
      render: (s) => <span className="font-medium text-primary">{s.name}</span>,
    },
    {
      key: "project",
      header: "Project",
      csvHeader: "Project",
      sortValue: (s) => s.projectCode,
      searchValue: (s) => `${s.projectCode} ${s.projectName}`,
      csvValue: (s) => s.projectCode,
      render: (s) => (
        <Link href={`/projects/${s.projectId}`} className="text-secondary hover:text-[var(--brand-primary)] hover:underline">
          <span className="tabular text-muted">{s.projectCode}</span> · {s.projectName}
        </Link>
      ),
    },
    {
      key: "client",
      header: "Client",
      sortValue: (s) => s.clientName,
      searchValue: (s) => s.clientName,
      csvValue: (s) => s.clientName,
      render: (s) => s.clientName ?? <span className="text-subtle">—</span>,
    },
    {
      key: "address",
      header: "Address",
      csvHeader: "Address",
      sortValue: (s) => s.address,
      searchValue: (s) => s.address,
      csvValue: (s) => s.address,
      render: (s) => s.address ?? <span className="text-subtle">—</span>,
    },
    {
      key: "workers",
      header: "Workers",
      align: "right",
      sortValue: (s) => s.workers,
      csvValue: (s) => s.workers,
      render: (s) => <span className="tabular text-secondary">{s.workers}</span>,
    },
    {
      key: "timesheets",
      header: "Timesheet rows",
      align: "right",
      defaultHidden: true,
      sortValue: (s) => s.timesheetRows,
      csvValue: (s) => s.timesheetRows,
      render: (s) => <span className="tabular text-secondary">{s.timesheetRows}</span>,
    },
  ];

  return (
    <DataTable
      rows={sites}
      columns={columns}
      searchable
      searchPlaceholder="Search sites by name, project, client or address…"
      pageSize={25}
      csvFilename={`sites-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{ entityLabel: "sites", columns: IMPORT_COLUMNS, importAction: bulkImportSitesAction }}
      filters={[
        { key: "project", label: "All projects", options: projectOptions, get: (s) => s.projectId },
        { key: "client", label: "All clients", options: clientOptions, get: (s) => s.clientName },
        { key: "use", label: "Any usage", options: [{ value: "used", label: "In use" }, { value: "unused", label: "Not in use" }], get: (s) => (s.workers > 0 || s.timesheetRows > 0 ? "used" : "unused") },
      ]}
      emptyState={<p className="px-4 py-10 text-center text-sm text-muted">No sites yet. Add one above, or import a list with the Import button.</p>}
      renderRowActions={(s) =>
        s.workers > 0 || s.timesheetRows > 0 ? (
          <span className="text-xs text-subtle" title="In use by workers or timesheet rows — clear those first">
            In use
          </span>
        ) : (
          <DeleteButton action={deleteSiteAction} hiddenFields={{ siteId: s.id }} confirmMessage={`Delete site "${s.name}"?`} />
        )
      }
    />
  );
}
