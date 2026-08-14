import Link from "next/link";
import { Bus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { createVehicleAction, deleteVehicleAction } from "./actions";

const STATUS_COLOR = {
  ACTIVE: "green",
  MAINTENANCE: "amber",
  INACTIVE: "slate",
} as const;

export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const vehicles = await prisma.vehicle.findMany({
    include: { _count: { select: { employees: true, projects: true } } },
    orderBy: { plateNumber: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Transport</h1>
        <p className="mt-1 text-sm text-muted">
          Manage vehicles, their driver, and which employees and projects
          they serve.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        action={createVehicleAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Plate number
          </span>
          <input
            name="plateNumber"
            required
            placeholder="e.g. DXB A 12345"
            className="input w-full"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Type
          </span>
          <input
            name="type"
            placeholder="e.g. 30-seater bus"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          + Add Vehicle
        </button>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={Bus}
          title="No vehicles yet"
          description="Vehicles carry workers between the camp and site. Add one above to record its plate, capacity and driver, then build pickup routes around it."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Plate</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3 text-right">Roster</th>
                <th className="px-4 py-3 text-right">Projects</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-primary">
                    <Link href={`/transport/${v.id}`} className="hover:underline">
                      {v.plateNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-secondary">{v.type || "—"}</td>
                  <td className="px-4 py-3 text-secondary">
                    {v.driverName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-secondary">
                    {v._count.employees}
                    {v.capacity ? ` / ${v.capacity}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right text-secondary">
                    {v._count.projects}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[v.status as keyof typeof STATUS_COLOR] || "slate"}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteButton
                      action={deleteVehicleAction}
                      hiddenFields={{ vehicleId: v.id }}
                      confirmMessage={`Delete vehicle "${v.plateNumber}"?${
                        v._count.employees > 0
                          ? ` ${v._count.employees} employee(s) will be unassigned.`
                          : ""
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
