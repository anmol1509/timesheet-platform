import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type EntityCounts = {
  clients: number;
  suppliers: number;
  projects: number;
};

// Mirrors the competitor dashboard's "Business Associates" widget — total
// counts, not just the active-status subset already shown elsewhere.
export async function getEntityCounts(branchId: string | null): Promise<EntityCounts> {
  const where = branchWhere(branchId);
  const [clients, suppliers, projects] = await Promise.all([
    prisma.client.count({ where }),
    prisma.supplier.count({ where }),
    prisma.project.count({ where }),
  ]);
  return { clients, suppliers, projects };
}
