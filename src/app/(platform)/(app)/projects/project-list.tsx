"use client";

import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import type { BadgeColor } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { DeleteButton } from "@/components/DeleteButton";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { bulkImportProjectsAction, deleteProjectAction } from "./actions";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clientName: string;
  address: string | null;
  manager: string | null;
  managerPhone: string | null;
  managerEmail: string | null;
  coordinator: string | null;
  coordinatorPhone: string | null;
  salesExecutive: string | null;
  salesExecutivePhone: string | null;
  timelineStart: string | null;
  timelineEnd: string | null;
  status: string;
  deployed: number;
  required: number | null;
  sites: number;
  openDemands: number;
  lpoCount: number;
  lpoValue: number;
  lpoBilled: number;
  daysLeft: number | null;
};

const STATUS_COLOR: Record<string, BadgeColor> = {
  ACTIVE: "green",
  PLANNING: "amber",
  COMPLETED: "slate",
  ON_HOLD: "red",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A column kept out of the way on screen, but exported (and importable) under its own heading. */
function hiddenText(key: string, header: string, get: (p: ProjectRow) => string | number | null): DataTableColumn<ProjectRow> {
  return {
    key,
    header,
    csvHeader: header,
    defaultHidden: true,
    sortValue: get,
    searchValue: get,
    csvValue: get,
    render: (p) => {
      const v = get(p);
      return v === null || v === "" ? <span className="text-subtle">—</span> : <span className="text-secondary">{v}</span>;
    },
  };
}

const IMPORT_COLUMNS = [
  { key: "name", label: "Project name", required: true, aliases: ["Project", "Name"] },
  { key: "code", label: "Code", aliases: ["Project code"] },
  { key: "client", label: "Client", required: true, aliases: ["Client name", "Company"] },
  { key: "description", label: "Description" },
  { key: "address", label: "Address", aliases: ["Location"] },
  { key: "manager", label: "Project manager", aliases: ["Manager"] },
  { key: "managerPhone", label: "Manager phone" },
  { key: "managerEmail", label: "Manager email" },
  { key: "coordinator", label: "Coordinator", aliases: ["Project coordinator"] },
  { key: "coordinatorPhone", label: "Coordinator phone" },
  { key: "salesExecutive", label: "Sales executive" },
  { key: "salesExecutivePhone", label: "Sales executive phone" },
  { key: "status", label: "Status" },
  { key: "start", label: "Start date", aliases: ["Timeline start", "Start"] },
  { key: "end", label: "End date", aliases: ["Timeline end", "End"] },
  { key: "required", label: "Workers required", aliases: ["No of employees required", "Required"] },
];

const STATUS_OPTIONS = ["ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED"].map((v) => ({ value: v, label: v.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) }));

export function ProjectList({ projects, emptyState }: { projects: ProjectRow[]; emptyState?: React.ReactNode }) {
  const clientOptions = [...new Set(projects.map((p) => p.clientName))].sort().map((v) => ({ value: v, label: v }));
  const columns: DataTableColumn<ProjectRow>[] = [
    {
      key: "name",
      header: "Project",
      locked: true,
      sortValue: (p) => p.name,
      searchValue: (p) => `${p.name} ${p.description ?? ""}`,
      csvHeader: "Project name",
      csvValue: (p) => p.name,
      render: (p) => (
        <Link href={`/projects/${p.id}`} className="group flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-violet-600">
            <FolderKanban className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-primary group-hover:underline">{p.name}</span>
            <span className="block max-w-[16rem] truncate text-xs text-subtle">{p.clientName}{p.description ? ` · ${p.description}` : ""}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
      csvHeader: "Code",
      sortValue: (p) => p.code,
      csvValue: (p) => p.code,
      render: (p) => <span className="tabular text-muted">{p.code}</span>,
    },
    {
      key: "client",
      header: "Client",
      csvHeader: "Client",
      sortValue: (p) => p.clientName,
      csvValue: (p) => p.clientName,
      render: (p) => <span className="text-secondary">{p.clientName}</span>,
    },
    {
      key: "address",
      header: "Address",
      csvHeader: "Address",
      defaultHidden: true,
      sortValue: (p) => p.address,
      searchValue: (p) => p.address,
      csvValue: (p) => p.address,
      render: (p) => p.address || <span className="text-subtle">—</span>,
    },
    {
      key: "manager",
      header: "Project Manager",
      csvHeader: "Project manager",
      sortValue: (p) => p.manager,
      searchValue: (p) => p.manager,
      csvValue: (p) => p.manager,
      render: (p) =>
        p.manager ? (
          <div className="flex flex-col text-sm" onClick={(e) => e.stopPropagation()}>
            <span className="text-primary">{p.manager}</span>
            {p.managerPhone && (
              <a href={`tel:${p.managerPhone}`} className="tabular text-xs text-muted hover:text-[var(--brand-primary)] hover:underline">
                {p.managerPhone}
              </a>
            )}
            {p.managerEmail && (
              <a href={`mailto:${p.managerEmail}`} className="max-w-[180px] truncate text-xs text-muted hover:text-[var(--brand-primary)] hover:underline">
                {p.managerEmail}
              </a>
            )}
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "coordinator",
      header: "Coordinator",
      csvHeader: "Coordinator",
      defaultHidden: true,
      sortValue: (p) => p.coordinator,
      searchValue: (p) => p.coordinator,
      csvValue: (p) => p.coordinator,
      render: (p) =>
        p.coordinator ? (
          <div className="flex flex-col text-sm">
            <span className="text-primary">{p.coordinator}</span>
            {p.coordinatorPhone && <a href={`tel:${p.coordinatorPhone}`} className="tabular text-xs text-muted hover:underline">{p.coordinatorPhone}</a>}
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "salesExecutive",
      header: "Sales executive",
      csvHeader: "Sales executive",
      defaultHidden: true,
      sortValue: (p) => p.salesExecutive,
      searchValue: (p) => p.salesExecutive,
      csvValue: (p) => p.salesExecutive,
      render: (p) =>
        p.salesExecutive ? (
          <div className="flex flex-col text-sm">
            <span className="text-primary">{p.salesExecutive}</span>
            {p.salesExecutivePhone && <a href={`tel:${p.salesExecutivePhone}`} className="tabular text-xs text-muted hover:underline">{p.salesExecutivePhone}</a>}
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
    {
      key: "workforce",
      header: "Workforce",
      sortValue: (p) => p.deployed,
      csvValue: (p) => (p.required ? `${p.deployed}/${p.required}` : String(p.deployed)),
      render: (p) =>
        p.required ? (
          <ProgressBar value={p.deployed} total={p.required} label={`${p.deployed} of ${p.required}`} />
        ) : (
          <span className="tabular text-secondary">{p.deployed} deployed</span>
        ),
    },
    {
      key: "demand",
      header: "Open demand",
      sortValue: (p) => p.openDemands,
      csvValue: (p) => p.openDemands,
      render: (p) =>
        p.openDemands > 0 ? <Badge color="amber">{p.openDemands} open</Badge> : <span className="text-subtle">—</span>,
    },
    {
      key: "lpo",
      header: "LPO billed",
      sortValue: (p) => p.lpoBilled,
      csvValue: (p) => (p.lpoCount ? `${p.lpoBilled}/${p.lpoValue}` : ""),
      render: (p) =>
        p.lpoCount === 0 ? (
          <span className="text-subtle">No active LPO</span>
        ) : p.lpoValue > 0 ? (
          <div className="flex flex-col gap-0.5">
            <ProgressBar value={p.lpoBilled} total={p.lpoValue} label={`${Math.round((p.lpoBilled / p.lpoValue) * 100)}%`} />
            <span className="tabular text-xs text-muted">
              {Math.round(p.lpoBilled).toLocaleString()} / {Math.round(p.lpoValue).toLocaleString()} AED
            </span>
          </div>
        ) : (
          <span className="text-secondary">{p.lpoCount} active</span>
        ),
    },
    {
      key: "sites",
      header: "Sites",
      defaultHidden: true,
      sortValue: (p) => p.sites,
      csvValue: (p) => p.sites,
      render: (p) => <span className="tabular text-secondary">{p.sites || "—"}</span>,
    },
    {
      key: "timeline",
      header: "Timeline",
      sortValue: (p) => p.timelineStart,
      render: (p) => (
        <div className="flex flex-col">
          <span className="tabular text-muted">
            {fmtDate(p.timelineStart)} – {fmtDate(p.timelineEnd)}
          </span>
          {p.daysLeft !== null && p.status !== "COMPLETED" && (
            <span className={`text-xs ${p.daysLeft < 0 ? "font-medium text-[var(--error)]" : p.daysLeft <= 30 ? "font-medium text-[var(--warning)]" : "text-muted"}`}>
              {p.daysLeft < 0 ? `Overdue by ${-p.daysLeft}d` : `${p.daysLeft}d left`}
            </span>
          )}
        </div>
      ),
    },
    hiddenText("managerPhone", "Manager phone", (p) => p.managerPhone),
    hiddenText("managerEmail", "Manager email", (p) => p.managerEmail),
    hiddenText("coordinatorPhone", "Coordinator phone", (p) => p.coordinatorPhone),
    hiddenText("salesExecutivePhone", "Sales executive phone", (p) => p.salesExecutivePhone),
    hiddenText("description", "Description", (p) => p.description),
    hiddenText("timelineStart", "Start date", (p) => (p.timelineStart ? p.timelineStart.slice(0, 10) : null)),
    hiddenText("timelineEnd", "End date", (p) => (p.timelineEnd ? p.timelineEnd.slice(0, 10) : null)),
    hiddenText("required", "Workers required", (p) => p.required),
    {
      key: "status",
      header: "Status",
      csvHeader: "Status",
      sortValue: (p) => p.status,
      csvValue: (p) => p.status,
      render: (p) => (
        <Badge color={STATUS_COLOR[p.status] || "slate"} dot>
          {p.status.replace("_", " ").toLowerCase()}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      rows={projects}
      emptyState={emptyState}
      columns={columns}
      searchable
      searchPlaceholder="Search projects by name, code, site, or manager…"
      pageSize={25}
      csvFilename={`projects-${new Date().toISOString().slice(0, 10)}.csv`}
      importConfig={{ entityLabel: "projects", columns: IMPORT_COLUMNS, importAction: bulkImportProjectsAction }}
      filters={[
        { key: "status", label: "All statuses", options: STATUS_OPTIONS, get: (p) => p.status },
        { key: "client", label: "All clients", options: clientOptions, get: (p) => p.clientName },
        { key: "demand", label: "Any demand", options: [{ value: "open", label: "Has open demand" }, { value: "none", label: "No open demand" }], get: (p) => (p.openDemands > 0 ? "open" : "none") },
      ]}
      renderRowActions={(p) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/projects/${p.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Link>
          <DeleteButton
            action={deleteProjectAction}
            hiddenFields={{ projectId: p.id }}
            confirmMessage={`Delete project "${p.name}"? Anyone assigned to it is unassigned. Projects with timesheet, attendance or LPO history can't be deleted — you'll be told which.`}
          />
        </div>
      )}
    />
  );
}
