"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { optionsOf } from "@/components/data-table/filterOptions";

type NocRow = {
  id: string;
  docNo: number;
  clientName: string;
  projectName: string;
  templateName: string;
  status: string;
  mobilizeDate: string | null;
  mobilizeInDays: number | null;
  demandNo: number;
  demandId: string;
  workers: number;
  workerNames: string[];
  allocated: number;
};

export function NocList({ nocs }: { nocs: NocRow[] }) {
  const columns: DataTableColumn<NocRow>[] = [
    { key: "docNo", header: "Doc No", render: (n) => `NOC-${n.docNo}`, csvValue: (n) => String(n.docNo) },
    { key: "clientName", header: "Client", render: (n) => n.clientName, csvValue: (n) => n.clientName },
    { key: "projectName", header: "Project", render: (n) => n.projectName, csvValue: (n) => n.projectName },
    { key: "templateName", header: "Template", render: (n) => n.templateName, csvValue: (n) => n.templateName },
    {
      key: "demand",
      header: "Demand",
      render: (n) => (
        <Link href={`/demand/${n.demandId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          #{n.demandNo}
        </Link>
      ),
      csvValue: (n) => String(n.demandNo),
      sortValue: (n) => n.demandNo,
    },
    {
      key: "workers",
      header: "Workers covered",
      render: (n) => (
        <div className="flex flex-col gap-1">
          {n.allocated > 0 ? (
            <ProgressBar value={n.workers} total={n.allocated} label={`${n.workers} of ${n.allocated} allocated`} />
          ) : (
            <span className="tabular text-secondary">{n.workers}</span>
          )}
          {n.workerNames.length > 0 && (
            <span className="max-w-[220px] truncate text-xs text-muted">
              {n.workerNames.join(", ")}
              {n.workers > n.workerNames.length ? ` +${n.workers - n.workerNames.length}` : ""}
            </span>
          )}
        </div>
      ),
      csvValue: (n) => n.workers,
      sortValue: (n) => n.workers,
    },
    {
      key: "status",
      header: "Status",
      render: (n) => (
        <Badge dot color={n.status === "Mobilization Complete" ? "green" : "amber"}>{n.status}</Badge>
      ),
      csvValue: (n) => n.status,
    },
    {
      key: "mobilizeDate",
      header: "Mobilize Date",
      render: (n) => (
        <div className="flex flex-col">
          <span className="text-secondary">{n.mobilizeDate || "—"}</span>
          {n.mobilizeInDays !== null && n.status !== "Mobilization Complete" && (
            <span className={`text-xs ${n.mobilizeInDays < 0 ? "font-medium text-[var(--error)]" : n.mobilizeInDays <= 3 ? "font-medium text-[var(--warning)]" : "text-muted"}`}>
              {n.mobilizeInDays < 0 ? `${-n.mobilizeInDays}d late` : n.mobilizeInDays === 0 ? "Today" : `in ${n.mobilizeInDays}d`}
            </span>
          )}
        </div>
      ),
      sortValue: (n) => n.mobilizeInDays,
      csvValue: (n) => n.mobilizeDate,
    },
  ];

  return (
    <DataTable
      rows={nocs}
      columns={columns}
      rowHref={(n) => `/operations/nocs/${n.id}`}
      filters={[
        { key: "status", label: "All statuses", options: optionsOf(nocs, (n) => n.status), get: (n) => n.status },
        { key: "client", label: "All clients", options: optionsOf(nocs, (n) => n.clientName), get: (n) => n.clientName },
        { key: "project", label: "All projects", options: optionsOf(nocs, (n) => n.projectName), get: (n) => n.projectName },
        {
          key: "mobilising", label: "Any mobilisation date",
          options: [{ value: "week", label: "Within 7 days" }, { value: "month", label: "Within 30 days" }, { value: "later", label: "Later" }, { value: "past", label: "Date passed" }, { value: "none", label: "No date set" }],
          get: (n) => (n.mobilizeInDays === null ? "none" : n.mobilizeInDays < 0 ? "past" : n.mobilizeInDays <= 7 ? "week" : n.mobilizeInDays <= 30 ? "month" : "later"),
        },
      ]}
    />
  );
}
