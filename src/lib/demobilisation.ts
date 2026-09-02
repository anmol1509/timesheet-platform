import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { releaseFromMobilisation } from "@/lib/employeeStageTransitions";

/**
 * Taking workers off a job.
 *
 * The closing half of the mobilisation cycle. It existed only in pieces before:
 * unallocating on the demand board, clearing the project on a profile,
 * deactivating from the roster — three routes that each did some of the work,
 * so what actually happened depended on which one somebody used.
 *
 * One placement is described by several records at once, and they all end
 * together here: the stage and its dates, the live project pointer, the open
 * assignment-history row, the demand allocation that put them there, and — when
 * the worker is leaving altogether — the bed they were occupying.
 */

export type DemobilisationContext = {
  branchId: string;
  userId: string;
  userName: string;
  isSuperAdmin: boolean;
};

export type DemobilisationOutcome =
  /** Off this job, back on the bench and available for the next one. */
  | "BENCH"
  /** Off the books entirely: no longer employed, bed released. */
  | "OFF_BOOKS";

export type DemobilisationResult = {
  demobilised: number;
  /** Demand allocations removed, which reopens those demand lines. */
  allocationsCleared: number;
  /** Beds freed, only ever when the worker leaves the books. */
  bedsReleased: number;
  /** Ids that were skipped because they belong to another branch. */
  skipped: number;
};

export async function demobiliseEmployees(
  employeeIds: string[],
  opts: { date: Date; reason: string | null; outcome: DemobilisationOutcome },
  ctx: DemobilisationContext
): Promise<DemobilisationResult> {
  const result: DemobilisationResult = {
    demobilised: 0,
    allocationsCleared: 0,
    bedsReleased: 0,
    skipped: 0,
  };
  if (employeeIds.length === 0) return result;

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
      name: true,
      branchId: true,
      status: true,
      active: true,
      projectId: true,
      siteId: true,
      project: { select: { name: true } },
      bed: { select: { id: true, label: true, room: { select: { name: true, camp: { select: { name: true } } } } } },
    },
  });

  for (const employee of employees) {
    // updateMany would take ids straight from the form, so the branch guard has
    // to happen here rather than inside it.
    if (employee.branchId !== ctx.branchId && !ctx.isSuperAdmin) {
      result.skipped++;
      continue;
    }

    // The allocation is what put them on this job; leaving it behind would keep
    // the demand looking filled by someone who has gone.
    const allocations = await prisma.demandRequestAllocation.deleteMany({
      where: { employeeId: employee.id },
    });
    result.allocationsCleared += allocations.count;

    // Close the placement rather than opening a new one — this row is the
    // record of where they were, and now of when and why it ended.
    const openHistory = await prisma.employeeAssignmentHistory.findFirst({
      where: { employeeId: employee.id, demobilizedDate: null },
      orderBy: { mobilizedDate: "desc" },
    });
    if (openHistory) {
      await prisma.employeeAssignmentHistory.update({
        where: { id: openHistory.id },
        data: {
          demobilizedDate: opts.date,
          demobilizationReason: opts.reason,
          demobilizedByName: ctx.userName,
        },
      });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        projectId: null,
        siteId: null,
        lastDemobilizedDate: opts.date,
        ...(opts.outcome === "OFF_BOOKS"
          ? { active: false, inactiveReason: opts.reason ?? "Demobilised" }
          : {}),
      },
    });

    // Clears the stage and both its dates. Deliberately after the update above,
    // so the two writes can't disagree about which came first.
    await releaseFromMobilisation([employee.id]);

    // A bed is held for someone who is coming back. Somebody off the books is
    // not, and leaving them in it hides a vacancy from the camp.
    if (opts.outcome === "OFF_BOOKS" && employee.bed) {
      await prisma.bed.update({ where: { id: employee.bed.id }, data: { employeeId: null } });
      const openStay = await prisma.accommodationHistory.findFirst({
        where: { employeeId: employee.id, checkOutDate: null },
        orderBy: { checkInDate: "desc" },
      });
      if (openStay) {
        await prisma.accommodationHistory.update({
          where: { id: openStay.id },
          data: { checkOutDate: opts.date },
        });
      }
      result.bedsReleased++;
    }

    await logAudit({
      entityType: "EMPLOYEE_DEMOBILISATION",
      entityId: employee.id,
      action: "UPDATE",
      before: {
        status: employee.status,
        projectId: employee.projectId,
        projectName: employee.project?.name ?? null,
        active: employee.active,
      },
      after: {
        status: opts.outcome === "OFF_BOOKS" ? "IDLE (off the books)" : "IDLE",
        projectId: null,
        active: opts.outcome === "OFF_BOOKS" ? false : employee.active,
        demobilizedDate: opts.date.toISOString().slice(0, 10),
        reason: opts.reason,
      },
      userId: ctx.userId,
      userName: ctx.userName,
      branchId: ctx.branchId,
    });

    result.demobilised++;
  }

  return result;
}
