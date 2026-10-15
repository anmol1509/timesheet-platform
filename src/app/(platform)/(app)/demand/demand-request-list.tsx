"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";

type Row = {
  id: string;
  requestNo: number;
  clientName: string;
  projectName: string;
  status: string;
  requestType: string;
  priority: string | null;
  createdAt: string;
  ageDays: number;
  trades: { trade: string; quantity: number }[];
  requested: number;
  /** null until someone has decided a line. */
  approved: number | null;
  allocated: number;
  offersSent: number;
  offersAccepted: number;
  offersDeclined: number;
  nocs: number;
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  Open: "amber",
  Approved: "green",
  Rejected: "red",
  Closed: "slate",
};

const PRIORITY_COLOR: Record<string, "red" | "amber" | "slate"> = { High: "red", Medium: "amber", Low: "slate" };

export function DemandRequestList({ requests }: { requests: Row[] }) {
  const columns: DataTableColumn<Row>[] = [
    {
      key: "requestNo",
      header: "Request",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <Link href={`/demand/${r.id}`} className="font-medium text-primary hover:underline">
            #{r.requestNo}
          </Link>
          <span className="text-xs text-muted">{r.requestType}</span>
        </div>
      ),
      csvValue: (r) => String(r.requestNo),
      sortValue: (r) => r.requestNo,
    },
    {
      key: "client",
      header: "Client / project",
      render: (r) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-primary">{r.clientName}</span>
          <span className="text-xs text-muted">{r.projectName}</span>
        </div>
      ),
      csvValue: (r) => `${r.clientName} / ${r.projectName}`,
      sortValue: (r) => r.clientName,
    },
    {
      key: "trades",
      header: "Trades",
      render: (r) => {
        const shown = r.trades.slice(0, 2);
        const more = r.trades.length - shown.length;
        return (
          <div className="flex flex-col gap-0.5 text-sm">
            {shown.map((t, i) => (
              <span key={i} className="text-secondary">
                <span className="tabular font-medium text-primary">{t.quantity}</span> {t.trade}
              </span>
            ))}
            {more > 0 && <span className="text-xs text-muted">+{more} more</span>}
          </div>
        );
      },
      csvValue: (r) => r.trades.map((t) => `${t.quantity} ${t.trade}`).join("; "),
    },
    {
      key: "requested",
      header: "Requested",
      render: (r) => (
        <span className="tabular">
          <span className="font-medium text-primary">{r.requested}</span>
          {r.approved !== null && r.approved !== r.requested && (
            <span className="ml-1 text-xs text-muted">({r.approved} approved)</span>
          )}
        </span>
      ),
      csvValue: (r) => r.requested,
      sortValue: (r) => r.requested,
    },
    {
      key: "allocated",
      header: "Allocated",
      render: (r) => {
        const target = r.approved ?? r.requested;
        return target > 0 ? <ProgressBar value={r.allocated} total={target} /> : <span className="text-muted">—</span>;
      },
      csvValue: (r) => `${r.allocated}/${r.approved ?? r.requested}`,
      sortValue: (r) => (r.approved ?? r.requested) > 0 ? r.allocated / (r.approved ?? r.requested) : 0,
    },
    {
      key: "offers",
      header: "Supplier offers",
      render: (r) =>
        r.offersSent === 0 ? (
          <span className="text-muted">None sent</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            <Badge color="slate">{r.offersSent} sent</Badge>
            {r.offersAccepted > 0 && <Badge color="green">{r.offersAccepted} accepted</Badge>}
            {r.offersDeclined > 0 && <Badge color="red">{r.offersDeclined} declined</Badge>}
          </span>
        ),
      csvValue: (r) => `${r.offersSent} sent, ${r.offersAccepted} accepted, ${r.offersDeclined} declined`,
      sortValue: (r) => r.offersSent,
    },
    {
      key: "nocs",
      header: "NOCs",
      render: (r) => <span className="tabular text-secondary">{r.nocs || "—"}</span>,
      csvValue: (r) => r.nocs,
      sortValue: (r) => r.nocs,
    },
    {
      key: "age",
      header: "Raised",
      render: (r) => {
        const d = r.ageDays;
        const stale = r.status === "Open" && d >= 7;
        return (
          <span className={`tabular text-sm ${stale ? "font-medium text-[var(--warning)]" : "text-secondary"}`}>
            {d === 0 ? "Today" : `${d}d ago`}
          </span>
        );
      },
      csvValue: (r) => r.createdAt.slice(0, 10),
      sortValue: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge color={STATUS_COLOR[r.status] ?? "slate"} dot>{r.status}</Badge>
          {r.priority === "High" && <Badge color={PRIORITY_COLOR.High}>High priority</Badge>}
        </div>
      ),
      csvValue: (r) => r.status,
      sortValue: (r) => r.status,
    },
  ];

  return (
    <DataTable
      rows={requests}
      columns={columns}
      rowHref={(r) => `/demand/${r.id}`}
      csvFilename={`demand-requests-${new Date().toISOString().slice(0, 10)}.csv`}
    />
  );
}
