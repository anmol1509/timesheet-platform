"use client";

import { Badge } from "@/components/Badge";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";

type NocRow = {
  id: string;
  docNo: number;
  clientName: string;
  projectName: string;
  templateName: string;
  status: string;
  mobilizeDate: string | null;
};

export function NocList({ nocs }: { nocs: NocRow[] }) {
  const columns: DataTableColumn<NocRow>[] = [
    { key: "docNo", header: "Doc No", render: (n) => `NOC-${n.docNo}`, csvValue: (n) => String(n.docNo) },
    { key: "clientName", header: "Client", render: (n) => n.clientName, csvValue: (n) => n.clientName },
    { key: "projectName", header: "Project", render: (n) => n.projectName, csvValue: (n) => n.projectName },
    { key: "templateName", header: "Template", render: (n) => n.templateName, csvValue: (n) => n.templateName },
    {
      key: "status",
      header: "Status",
      render: (n) => (
        <Badge color={n.status === "Mobilization Complete" ? "green" : "amber"}>{n.status}</Badge>
      ),
      csvValue: (n) => n.status,
    },
    {
      key: "mobilizeDate",
      header: "Mobilize Date",
      render: (n) => n.mobilizeDate || "—",
      csvValue: (n) => n.mobilizeDate,
    },
  ];

  return <DataTable rows={nocs} columns={columns} rowHref={(n) => `/operations/nocs/${n.id}`} />;
}
