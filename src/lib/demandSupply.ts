import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

/**
 * How many idle workers are available against each trade line on a demand.
 *
 * Two things make this less obvious than it looks:
 *
 * 1. A worker's trade is recorded in two places. `Employee.trade` is a plain
 *    string and is set on almost the whole roster; `EmployeeSkill` is the
 *    taxonomy join and is barely populated. Counting only the join would report
 *    zero for every trade, so a worker counts if *either* source matches.
 *
 * 2. "Idle" means available to mobilise: on the books, not terminated, and not
 *    already on a project. Supplier-supplied labour also needs its supplier and
 *    that supplier's labour approved, which is the rule the demand screen
 *    already applied before this.
 */
export type TradeSupply = {
  /** Idle workers whose trade matches the line. */
  matching: number;
  /** Idle workers available but of some other trade. */
  other: number;
};

type IdleWorker = {
  id: string;
  name: string;
  employeeIdNo: string;
  trade: string | null;
  skillNames: string[];
  /** The supplier behind this worker, when there is one. */
  supplierId: string | null;
  /** Why the worker can't be mobilised yet (their supplier isn't approved), or null when they can. */
  blocked: string | null;
};

/**
 * Every worker who could be mobilised right now, with their trades. Workers whose supplier or its labour isn't
 * approved are left out unless `includeBlocked` is set, in which case they come back with `blocked` saying why.
 */
export async function getIdleWorkers(branchId: string | null, opts: { includeBlocked?: boolean } = {}): Promise<IdleWorker[]> {
  const rows = await prisma.employee.findMany({
    where: {
      ...branchWhere(branchId),
      active: true,
      status: { not: "TERMINATED" },
      projectId: null,
    },
    select: {
      id: true,
      name: true,
      employeeIdNo: true,
      trade: true,
      supplierId: true,
      supplier: { select: { name: true, approvalStatus: true, labourApprovalStatus: true } },
      skills: { select: { skill: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const all = rows.map((e) => ({
    id: e.id,
    name: e.name,
    employeeIdNo: e.employeeIdNo,
    trade: e.trade,
    skillNames: e.skills.map((s) => s.skill.name),
    supplierId: e.supplierId,
    blocked: !e.supplier
      ? null
      : e.supplier.approvalStatus !== "Approved"
        ? `${e.supplier.name} is not approved yet`
        : e.supplier.labourApprovalStatus !== "Approved"
          ? `${e.supplier.name} has no labour approval yet`
          : null,
  }));
  return opts.includeBlocked ? all : all.filter((w) => !w.blocked);
}

/** Case- and space-insensitive, since the two trade sources are typed by hand. */
function sameTrade(a: string | null | undefined, b: string) {
  if (!a) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function workerHasTrade(worker: IdleWorker, tradeName: string) {
  return (
    sameTrade(worker.trade, tradeName) ||
    worker.skillNames.some((name) => sameTrade(name, tradeName))
  );
}

/** Splits the idle pool into "this trade" and "everyone else" for one line. */
export function supplyForTrade(workers: IdleWorker[], tradeName: string): TradeSupply {
  const matching = workers.filter((w) => workerHasTrade(w, tradeName)).length;
  return { matching, other: workers.length - matching };
}
