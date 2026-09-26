import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader
        title="New Route"
        icon={FilePlus2}
        description={<>Define a named pickup route with ordered stops.</>}
      />
      <RouteForm vehicles={vehicles} projects={projects} initialVehicleId={vehicleId} />
    </div>
  );
}
