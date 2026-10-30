import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { activeDocTypes, buildChecklist, resolveDocTypes } from "@/lib/documentTypes";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditVehicleForm } from "./edit-form";
import { ProjectRoutes } from "./project-routes";
import { RosterManager } from "./roster-manager";
import { deleteVehicleAction } from "../actions";

export const metadata = { title: "Vehicle" };

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
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const [vehicle, allProjects, allEmployees, files] = await Promise.all([
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
    prisma.project.findMany({ where: branchWhere(branchId), orderBy: { name: "asc" } }),
    prisma.employee.findMany({
      where: branchWhere(branchId),
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
    prisma.attachment.findMany({
      where: { entityType: "VEHICLE", entityId: id },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, docType: true, filename: true, expiryDate: true, uploadedAt: true },
    }),
  ]);
  if (!vehicle || isOutsideBranch(vehicle.branchId, branchId, isSuperAdmin)) notFound();

  const typeRows = vehicle.branchId ? await prisma.documentType.findMany({ where: { branchId: vehicle.branchId } }) : [];
  const types = resolveDocTypes(typeRows, "VEHICLE");
  const docFiles = files.map((a) => ({ id: a.id, docType: a.docType, filename: a.filename, expiryDate: a.expiryDate ? a.expiryDate.toISOString() : null, uploadedAt: a.uploadedAt.toISOString() }));
  const known = new Set(types.map((t) => t.key));
  const canEdit = can(subjectOf(user), "facilities.transport", "edit");

  return (
    <div className="form-comfy max-w-5xl space-y-6">
      <div>
        <Link href="/transport" className="text-sm text-muted hover:underline">
          ← Transport
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl tracking-tight text-primary font-semibold">
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
            className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[var(--error-soft)]"
          />
        </div>
        <p className="mt-1 text-sm text-muted">
          {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || vehicle.type || "No type set"} · {vehicle.employees.length}
          {vehicle.capacity ? ` / ${vehicle.capacity}` : ""} on roster
        </p>
      </div>

      <EditVehicleForm
        vehicle={{
          id: vehicle.id,
          plateNumber: vehicle.plateNumber,
          type: vehicle.type,
          capacity: vehicle.capacity,
          driverName: vehicle.driverName,
          driverPhone: vehicle.driverPhone,
          registrationExpiry: toDateInput(vehicle.registrationExpiry),
          insuranceExpiry: toDateInput(vehicle.insuranceExpiry),
          status: vehicle.status,
          notes: vehicle.notes,
          driverEmployeeId: vehicle.driverEmployeeId,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          colour: vehicle.colour,
          chassisNumber: vehicle.chassisNumber,
          engineNumber: vehicle.engineNumber,
          trafficFileNumber: vehicle.trafficFileNumber,
          plateEmirate: vehicle.plateEmirate,
          plateCategory: vehicle.plateCategory,
          fuelType: vehicle.fuelType,
          ownership: vehicle.ownership,
          lessor: vehicle.lessor,
          odometerKm: vehicle.odometerKm,
        }}
        drivers={allEmployees.map((e) => ({ id: e.id, name: e.name, employeeIdNo: e.employeeIdNo }))}
      />

      <div className="card space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold text-primary">Documents</h2>
          <p className="mt-1 text-sm text-muted">
            Mulkiya, insurance, passing test, permits and the lease contract. The Mulkiya and insurance expiry dates above follow the latest file uploaded.
          </p>
        </div>
        <DocumentChecklist items={buildChecklist(types, docFiles, false)} />
        {canEdit && (
          <AttachmentUploader
            entityType="VEHICLE"
            entityId={vehicle.id}
            entityBranchId={vehicle.branchId}
            revalidate={`/transport/${vehicle.id}`}
            docTypeOptions={[
              ...activeDocTypes(types).map((t) => ({ value: t.key, label: t.label })),
              ...[...new Set(docFiles.map((a) => a.docType))].filter((k) => !known.has(k)).map((k) => ({ value: k, label: k })),
            ]}
            attachments={docFiles}
          />
        )}
      </div>

      <ProjectRoutes
        vehicleId={vehicle.id}
        assignedProjects={vehicle.projects.map((vp) => ({
          id: vp.project.id,
          name: vp.project.name,
          code: vp.project.code,
        }))}
        allProjects={allProjects.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
      />

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Routes</h2>
          <Link
            href={`/transport/routes/new?vehicleId=${vehicle.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-primary)] hover:underline"
          >
            <Plus className="h-4 w-4" aria-hidden />

            New Route
          </Link>
        </div>
        {vehicle.routes.length === 0 ? (
          <p className="text-sm text-muted">No routes for this vehicle yet.</p>
        ) : (
          <ul className="space-y-1">
            {vehicle.routes.map((r) => (
              <li key={r.id} className="text-sm">
                <Link href={`/transport/routes/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.name}
                </Link>{" "}
                <span className="text-subtle">{r.stops.length} stop(s)</span>
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
