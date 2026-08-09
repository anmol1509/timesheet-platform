import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditVehicleForm } from "./edit-form";
import { ProjectRoutes } from "./project-routes";
import { RosterManager } from "./roster-manager";
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
  const [vehicle, allProjects, allEmployees] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            project: { select: { name: true } },
            skills: { include: { skill: { select: { name: true } } } },
          },
          orderBy: { name: "asc" },
        },
        projects: { include: { project: true } },
        routes: { include: { stops: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        employeeIdNo: true,
        trade: true,
        vehicleId: true,
        project: { select: { name: true } },
        skills: { select: { skill: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
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

      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Routes</h2>
          <Link
            href={`/transport/routes/new?vehicleId=${vehicle.id}`}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            + New Route
          </Link>
        </div>
        {vehicle.routes.length === 0 ? (
          <p className="text-sm text-slate-500">No routes for this vehicle yet.</p>
        ) : (
          <ul className="space-y-1">
            {vehicle.routes.map((r) => (
              <li key={r.id} className="text-sm">
                <Link href={`/transport/routes/${r.id}`} className="font-medium text-slate-900 hover:underline">
                  {r.name}
                </Link>{" "}
                <span className="text-slate-400">{r.stops.length} stop(s)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <RosterManager
        vehicleId={vehicle.id}
        roster={vehicle.employees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeIdNo: e.employeeIdNo,
          trade: e.trade,
          projectName: e.project?.name ?? null,
          skills: e.skills.map((s) => s.skill.name),
        }))}
        allEmployees={allEmployees.map((e) => ({
          id: e.id,
          name: e.name,
          employeeIdNo: e.employeeIdNo,
          trade: e.trade,
          vehicleId: e.vehicleId,
          projectName: e.project?.name ?? null,
          skills: e.skills.map((s) => s.skill.name),
        }))}
      />
    </div>
  );
}
