"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/Badge";
import type { BadgeColor } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { DeleteButton } from "@/components/DeleteButton";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { deleteProjectAction } from "./actions";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  clientName: string;
  address: string | null;
  manager: string | null;
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

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const columns: DataTableColumn<ProjectRow>[] = [
    {
      key: "name",
      header: "Project",
      locked: true,
      sortValue: (p) => p.name,
      searchValue: (p) => `${p.name} ${p.description ?? ""}`,
      csvValue: (p) => p.name,
      render: (p) => (
        <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">
          {p.name}
          {p.description && <p className="text-xs font-normal text-subtle">{p.description}</p>}
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortValue: (p) => p.code,
      csvValue: (p) => p.code,
      render: (p) => <span className="tabular text-muted">{p.code}</span>,
    },
    {
      key: "client",
      header: "Client",
      sortValue: (p) => p.clientName,
      csvValue: (p) => p.clientName,
      render: (p) => <span className="text-secondary">{p.clientName}</span>,
    },
    {
      key: "address",
      header: "Address",
      defaultHidden: true,
      sortValue: (p) => p.address,
      searchValue: (p) => p.address,
      csvValue: (p) => p.address,
      render: (p) => p.address || <span className="text-subtle">—</span>,
    },
    {
      key: "manager",
      header: "Project Manager",
      sortValue: (p) => p.manager,
      searchValue: (p) => p.manager,
      csvValue: (p) => p.manager,
      render: (p) => p.manager || <span className="text-subtle">—</span>,
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
      csvValue: (p) => `${fmtDate(p.timelineStart)} – ${fmtDate(p.timelineEnd)}`,
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
    {
      key: "status",
      header: "Status",
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
      columns={columns}
      searchable
      searchPlaceholder="Search projects by name, code, site, or manager…"
      pageSize={25}
      csvFilename={`projects-${new Date().toISOString().slice(0, 10)}.csv`}
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
