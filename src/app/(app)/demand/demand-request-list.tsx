"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";

type Row = {
  id: string;
  requestNo: number;
  clientName: string;
  projectName: string;
  status: string;
  priority: string | null;
  salesExecutive: string | null;
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  Open: "amber",
  Approved: "green",
  Rejected: "red",
  Closed: "slate",
};

export function DemandRequestList({ requests }: { requests: Row[] }) {
  const columns: DataTableColumn<Row>[] = [
    {
      key: "requestNo",
      header: "Request No",
      render: (r) => (
        <Link href={`/demand/${r.id}`} className="font-medium text-primary hover:underline">
          {r.requestNo}
        </Link>
      ),
      csvValue: (r) => String(r.requestNo),
    },
    { key: "clientName", header: "Client", render: (r) => r.clientName, csvValue: (r) => r.clientName },
    { key: "projectName", header: "Project", render: (r) => r.projectName, csvValue: (r) => r.projectName },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge color={STATUS_COLOR[r.status] ?? "slate"}>{r.status}</Badge>,
      csvValue: (r) => r.status,
    },
    { key: "priority", header: "Priority", render: (r) => r.priority || "—", csvValue: (r) => r.priority },
    {
      key: "salesExecutive",
      header: "Sales Executive",
      render: (r) => r.salesExecutive || "—",
      csvValue: (r) => r.salesExecutive,
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
