import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type BulkSaveListRow = { id: string; at: string; by: string; month: string; workers: number };

/** Bulk timesheet saves in this company that have not been undone, newest first. Pass `only` to fetch one save by its id. */
export async function loadBulkSaves(branchId: string | null, opts: { only?: string; days?: number } = {}): Promise<BulkSaveListRow[]> {
  const since = new Date(Date.now() - (opts.days ?? 30) * 86_400_000);
  const rows = await prisma.auditLog.findMany({
    where: { entityType: "BULK_TIMESHEET", action: "CREATE", revertedAt: null, ...branchWhere(branchId), ...(opts.only ? { id: opts.only } : { createdAt: { gte: since } }) },
    orderBy: { createdAt: "desc" },
    take: opts.only ? 1 : 5,
    select: { id: true, createdAt: true, userName: true, changes: true },
  });
  return rows.map((r) => {
    const c = (r.changes ?? {}) as { month?: string; workers?: unknown[] };
    return { id: r.id, at: r.createdAt.toISOString(), by: r.userName, month: c.month ?? "", workers: Array.isArray(c.workers) ? c.workers.length : 0 };
  });
}
