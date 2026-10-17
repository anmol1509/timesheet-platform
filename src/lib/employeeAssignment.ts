import { prisma } from "@/lib/db";
import { releaseFromMobilisation } from "@/lib/employeeStageTransitions";

/**
 * Keeps placement history in step when a worker's project changes. Taking the
 * project away ends the placement, so the mobilisation stage and its dates end
 * with it — the same rule the demand screen applies when a worker is
 * unallocated, so the routes can't leave the roster disagreeing.
 */
export async function recordProjectChange(before: { id: string; projectId: string | null; branchId: string | null }, nextProjectId: string | null) {
  if (before.projectId && !nextProjectId) await releaseFromMobilisation([before.id]);
  if (before.projectId === nextProjectId) return;

  const openHistory = await prisma.employeeAssignmentHistory.findFirst({
    where: { employeeId: before.id, demobilizedDate: null },
    orderBy: { mobilizedDate: "desc" },
  });
  if (openHistory) {
    await prisma.employeeAssignmentHistory.update({ where: { id: openHistory.id }, data: { demobilizedDate: new Date() } });
  }
  if (nextProjectId) {
    const [project, branch] = await Promise.all([
      prisma.project.findUnique({ where: { id: nextProjectId }, select: { name: true } }),
      before.branchId ? prisma.branch.findUnique({ where: { id: before.branchId }, select: { name: true } }) : null,
    ]);
    await prisma.employeeAssignmentHistory.create({
      data: { employeeId: before.id, projectId: nextProjectId, projectName: project?.name ?? null, branchName: branch?.name ?? null },
    });
  }
}
