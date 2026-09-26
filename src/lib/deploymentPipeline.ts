import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type DeploymentStage = { key: string; label: string; count: number };

/**
 * Where the workforce sits between "on the books" and "working a shift",
 * read off the same EmployeeStatus progression attendance/mobilisation
 * already drive — no separate recruitment-pipeline data to maintain.
 */
export async function getDeploymentPipeline(branchId: string | null): Promise<DeploymentStage[]> {
  const rows = await prisma.employee.groupBy({
    by: ["status"],
    where: { ...branchWhere(branchId), status: { not: "TERMINATED" } },
    _count: { _all: true },
  });
  const byStatus = new Map(rows.map((r) => [r.status, r._count._all]));
  return [
    { key: "IDLE", label: "Available", count: byStatus.get("IDLE") ?? 0 },
    { key: "UNDER_MOBILISATION", label: "Mobilising", count: byStatus.get("UNDER_MOBILISATION") ?? 0 },
    { key: "ON_SITE", label: "Arrived on site", count: byStatus.get("ON_SITE") ?? 0 },
    { key: "ACTIVE", label: "Deployed", count: byStatus.get("ACTIVE") ?? 0 },
  ];
}
