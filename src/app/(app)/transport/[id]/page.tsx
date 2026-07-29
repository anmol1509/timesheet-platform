import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditVehicleForm } from "./edit-form";
import { ProjectRoutes } from "./project-routes";
import { deleteVehicleAction } from "../actions";

const STATUS_COLOR = {
  ACTIVE: "green",
  MAINTENANCE: "amber",
  INACTIVE: "slate",
} as const;

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [vehicle, allProjects] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id },
      include: {
        employees: { orderBy: { name: "asc" } },
        projects: { include: { project: true } },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!vehicle) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/transport" className="text-sm text-slate-500 hover:underline">
          ← Transport
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {vehicle.plateNumber}
            </h1>
            <Badge color={STATUS_COLOR[vehicle.status as keyof typeof STATUS_COLOR] || "slate"}>
              {vehicle.status}
            </Badge>
          </div>
          <DeleteButton
            action={deleteVehicleAction}
            hiddenFields={{ vehicleId: vehicle.id }}
            confirmMessage={`Delete vehicle "${vehicle.plateNumber}"?${
              vehicle.employees.length > 0
                ? ` ${vehicle.employees.length} employee(s) will be unassigned.`
                : ""
            }`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {vehicle.type || "No type set"} · {vehicle.employees.length}
          {vehicle.capacity ? ` / ${vehicle.capacity}` : ""} on roster
        </p>
      </div>

      <EditVehicleForm
        vehicle={{
          id: vehicle.id,
          type: vehicle.type,
          capacity: vehicle.capacity,
          driverName: vehicle.driverName,
          driverPhone: vehicle.driverPhone,
          registrationExpiry: toDateInput(vehicle.registrationExpiry),
          insuranceExpiry: toDateInput(vehicle.insuranceExpiry),
          status: vehicle.status,
          notes: vehicle.notes,
        }}
      />

      <ProjectRoutes
        vehicleId={vehicle.id}
        assignedProjects={vehicle.projects.map((vp) => ({
          id: vp.project.id,
          name: vp.project.name,
          code: vp.project.code,
        }))}
        allProjects={allProjects.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Roster ({vehicle.employees.length})
        </h2>
        {vehicle.employees.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No employees assigned yet. Assign this vehicle from an
            employee&rsquo;s profile page.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {vehicle.employees.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/employees/${e.id}`}>{e.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.employeeIdNo}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.trade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
