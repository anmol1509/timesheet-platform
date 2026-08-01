import Link from "next/link";
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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Transport</h1>
        <p className="mt-1 text-sm text-slate-500">
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
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Plate number
          </span>
          <input
            name="plateNumber"
            required
            placeholder="e.g. DXB A 12345"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block flex-1 min-w-[160px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Type
          </span>
          <input
            name="type"
            placeholder="e.g. 30-seater bus"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add Vehicle
        </button>
      </form>

      {vehicles.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No vehicles yet. Add one above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
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
            <tbody className="divide-y divide-slate-100">
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/transport/${v.id}`} className="hover:underline">
                      {v.plateNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{v.type || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {v.driverName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {v._count.employees}
                    {v.capacity ? ` / ${v.capacity}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
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
