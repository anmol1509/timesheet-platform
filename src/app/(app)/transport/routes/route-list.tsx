"use client";

import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";

type RouteRow = {
  id: string;
  name: string;
  vehiclePlate: string;
  projectName: string | null;
  stopCount: number;
};

export function RouteList({ routes }: { routes: RouteRow[] }) {
  const columns: DataTableColumn<RouteRow>[] = [
    { key: "name", header: "Name", render: (r) => r.name, csvValue: (r) => r.name },
    { key: "vehiclePlate", header: "Vehicle", render: (r) => r.vehiclePlate, csvValue: (r) => r.vehiclePlate },
    {
      key: "projectName",
      header: "Project",
      render: (r) => r.projectName || "—",
      csvValue: (r) => r.projectName,
    },
    {
      key: "stopCount",
      header: "Stops",
      render: (r) => String(r.stopCount),
      csvValue: (r) => String(r.stopCount),
    },
  ];

  return <DataTable rows={routes} columns={columns} rowHref={(r) => `/transport/routes/${r.id}`} />;
}
