import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { RouteForm } from "../route-form";

export default async function NewRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleId?: string }>;
}) {
  const { vehicleId } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const [vehicles, projects] = await Promise.all([
    prisma.vehicle.findMany({ where: branchWhere(branchId), select: { id: true, plateNumber: true }, orderBy: { plateNumber: "asc" } }),
    prisma.project.findMany({ where: branchWhere(branchId), select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }),
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
