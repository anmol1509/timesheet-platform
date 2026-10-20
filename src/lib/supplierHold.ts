import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { needsFor, remainingOn, type Need, type OpenLine } from "@/lib/heldNeeds";

/**
 * A supplier whose approval (or labour approval) is still outstanding while workers of theirs sit idle. Those
 * workers can't be mobilised until it is decided, and nothing else says so, so this is what the import summary,
 * the Mobilise screen, the Approvals inbox and the daily reminder all draw on.
 */
export type HeldSupplier = {
  id: string;
  name: string;
  branchId: string;
  approvalStatus: string;
  labourApprovalStatus: string;
  workers: number;
  /** When the longest-waiting held worker was added. */
  oldestWorkerAt: Date;
  /** Open demand lines the held workers could fill. */
  needs: Need[];
};

/** Idle workers whose supplier isn't approved yet, grouped by supplier, most workers first. */
export async function heldSuppliers(branchId: string | null): Promise<HeldSupplier[]> {
  const workers = await prisma.employee.findMany({
    where: {
      ...branchWhere(branchId),
      active: true,
      status: { not: "TERMINATED" },
      projectId: null,
      supplier: { isOwnCompany: false, OR: [{ approvalStatus: { not: "Approved" } }, { labourApprovalStatus: { not: "Approved" } }] },
    },
    select: { trade: true, createdAt: true, supplier: { select: { id: true, name: true, branchId: true, approvalStatus: true, labourApprovalStatus: true } } },
  });
  if (workers.length === 0) return [];

  const lines = await openLines(branchId);
  const by = new Map<string, { s: NonNullable<(typeof workers)[number]["supplier"]>; n: number; at: Date; trades: Set<string> }>();
  for (const w of workers) {
    if (!w.supplier) continue;
    const cur = by.get(w.supplier.id) ?? { s: w.supplier, n: 0, at: w.createdAt, trades: new Set<string>() };
    cur.n++;
    if (w.createdAt < cur.at) cur.at = w.createdAt;
    if (w.trade) cur.trades.add(w.trade);
    by.set(w.supplier.id, cur);
  }
  return [...by.values()]
    .map(({ s, n, at, trades }) => ({
      id: s.id,
      name: s.name,
      branchId: s.branchId,
      approvalStatus: s.approvalStatus,
      labourApprovalStatus: s.labourApprovalStatus,
      workers: n,
      oldestWorkerAt: at,
      needs: needsFor([...trades], lines),
    }))
    .sort((a, b) => b.workers - a.workers || a.name.localeCompare(b.name));
}

/** Demand lines that still need heads, on requests that are still live. */
async function openLines(branchId: string | null): Promise<OpenLine[]> {
  const requests = await prisma.demandRequest.findMany({
    where: { ...branchWhere(branchId), status: { notIn: ["Closed", "Rejected"] } },
    orderBy: { requestNo: "asc" },
    select: { id: true, requestNo: true, trades: { select: { trade: true, quantity: true, approvedQuantity: true, _count: { select: { allocations: true } } } } },
  });
  return requests.flatMap((r) =>
    r.trades.map((t) => ({ requestId: r.id, requestNo: r.requestNo, trade: t.trade, remaining: remainingOn(t, t._count.allocations) })),
  );
}
