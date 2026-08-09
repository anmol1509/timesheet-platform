import { prisma } from "@/lib/db";
import { RouteForm } from "../route-form";

export default async function NewRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const [vehicles, projects] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, plateNumber: true }, orderBy: { plateNumber: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Route</h1>
        <p className="mt-1 text-sm text-slate-500">Define a named pickup route with ordered stops.</p>
      </div>
      <RouteForm vehicles={vehicles} projects={projects} initialVehicleId={vehicleId} />
    </div>
  );
}
